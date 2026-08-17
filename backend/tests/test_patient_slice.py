from sqlalchemy import select

from app.models import AuditLog, Hospital, Patient, Permission, Role, User
from app.security.passwords import hash_password
from app.security.permissions import PermissionKey


async def create_identity(session_factory, *, role_name: str, grants: set[PermissionKey]):
    async with session_factory() as session:
        hospital = Hospital(
            name=f"{role_name} Clinic",
            slug=f"{role_name.lower()}-clinic",
            email=f"{role_name.lower()}@clinic.test",
        )
        session.add(hospital)
        await session.flush()
        permissions = [
            Permission(key=grant, description=f"Allows {grant}") for grant in sorted(grants)
        ]
        role = Role(name=role_name, description=role_name, permissions=permissions)
        user = User(
            hospital_id=hospital.id,
            email=f"{role_name.lower()}@example.com",
            password_hash=hash_password("Password123!"),
            name=role_name.title(),
            roles=[role],
        )
        session.add(user)
        await session.commit()
        return hospital.id, user.email


async def login(client, email: str) -> dict:
    response = await client.post(
        "/api/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_patient_mutations_are_authorized_tenant_scoped_and_audited(client, session_factory):
    hospital_id, email = await create_identity(
        session_factory,
        role_name="CLINIC_ADMIN",
        grants=set(PermissionKey),
    )
    token = (await login(client, email))["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    created = await client.post(
        "/api/patients",
        headers=headers,
        json={
            "firstName": "Diane",
            "lastName": "Cooper",
            "phone": "+1-239-555-0108",
            "dateOfBirth": "1997-02-24",
            "gender": "FEMALE",
        },
    )
    assert created.status_code == 201, created.text
    patient = created.json()
    assert patient["patientId"].startswith("PAT")
    assert patient["firstName"] == "Diane"

    listed = await client.get("/api/patients?search=Diane", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["pagination"]["total"] == 1

    updated = await client.put(
        f"/api/patients/{patient['id']}", headers=headers, json={"city": "Cilacap"}
    )
    assert updated.status_code == 200
    assert updated.json()["patient"]["city"] == "Cilacap"

    archived = await client.delete(f"/api/patients/{patient['id']}", headers=headers)
    assert archived.status_code == 200
    assert (await client.get(f"/api/patients/{patient['id']}", headers=headers)).status_code == 404

    async with session_factory() as session:
        audit_logs = list(
            (
                await session.scalars(
                    select(AuditLog)
                    .where(AuditLog.hospital_id == hospital_id)
                    .order_by(AuditLog.created_at)
                )
            ).all()
        )
        assert [log.action for log in audit_logs] == ["CREATE", "UPDATE", "ARCHIVE"]


async def test_read_only_role_cannot_create_patient(client, session_factory):
    _, email = await create_identity(
        session_factory,
        role_name="READ_ONLY",
        grants={PermissionKey.PATIENTS_READ},
    )
    token = (await login(client, email))["accessToken"]
    response = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "firstName": "Blocked",
            "lastName": "Writer",
            "phone": "555-0199",
            "age": 30,
        },
    )
    assert response.status_code == 403


async def test_patient_from_another_clinic_is_not_visible(client, session_factory):
    hospital_id, email = await create_identity(
        session_factory,
        role_name="TENANT_ONE",
        grants={PermissionKey.PATIENTS_READ},
    )
    async with session_factory() as session:
        other = Hospital(name="Other", slug="other", email="other@clinic.test")
        session.add(other)
        await session.flush()
        hidden = Patient(
            hospital_id=other.id,
            patient_number="PAT202600001",
            first_name="Hidden",
            last_name="Patient",
            phone="555-0100",
            age=40,
        )
        session.add(hidden)
        await session.commit()
        hidden_id = hidden.id

    token = (await login(client, email))["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert (await client.get(f"/api/patients/{hidden_id}", headers=headers)).status_code == 404
    listing = await client.get("/api/patients", headers=headers)
    assert listing.status_code == 200
    assert listing.json()["pagination"]["total"] == 0
    assert hospital_id is not None

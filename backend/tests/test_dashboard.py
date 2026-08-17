from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.models import Appointment, Hospital, Invoice, Patient, Payment, Permission, Role, User
from app.security.passwords import hash_password
from app.security.permissions import PermissionKey


async def create_dashboard_identity(session_factory, *, slug: str, can_read: bool = True):
    async with session_factory() as session:
        hospital = Hospital(
            name=f"{slug.title()} Dental Centre",
            slug=slug,
            email=f"{slug}@clinic.test",
            locale="en-ET",
            country="ET",
            currency="ETB",
            timezone="Africa/Addis_Ababa",
        )
        session.add(hospital)
        await session.flush()
        grants = [PermissionKey.DASHBOARD_READ] if can_read else [PermissionKey.PATIENTS_READ]
        permissions = []
        for key in grants:
            permission = await session.scalar(select(Permission).where(Permission.key == key))
            if permission is None:
                permission = Permission(key=key, description=str(key))
            permissions.append(permission)
        role = Role(name=f"{slug.upper()}_ROLE", description=slug, permissions=permissions)
        user = User(
            hospital_id=hospital.id,
            email=f"{slug}@example.com",
            password_hash=hash_password("Password123!"),
            name="Clinic Owner",
            roles=[role],
        )
        patient = Patient(
            hospital_id=hospital.id,
            patient_number=f"{slug.upper()}-0001",
            first_name="Lulit",
            last_name="Bekele",
            phone=f"+251911{len(slug):06d}",
            age=29,
        )
        session.add_all([user, patient])
        await session.flush()
        now = datetime.now(UTC)
        appointment = Appointment(
            hospital_id=hospital.id,
            patient_id=patient.id,
            appointment_number=f"APT-{slug}-1",
            dentist_name="Dr. Hana Tesfaye",
            appointment_type="Dental check-up",
            scheduled_start=now,
            status="CHECKED_IN",
            chair_label="Chair 1",
        )
        invoice = Invoice(
            hospital_id=hospital.id,
            patient_id=patient.id,
            invoice_number=f"INV-{slug}-1",
            total_amount=Decimal("3000.00"),
            balance_due=Decimal("1250.00"),
            status="PARTIALLY_PAID",
            issued_at=now,
        )
        session.add_all([appointment, invoice])
        await session.flush()
        session.add(
            Payment(
                hospital_id=hospital.id,
                patient_id=patient.id,
                invoice_id=invoice.id,
                receipt_number=f"RCT-{slug}-1",
                amount=Decimal("1750.00"),
                method="TELEBIRR",
                received_at=now,
            )
        )
        await session.commit()
        return user.email


async def token_for(client, email: str) -> str:
    response = await client.post(
        "/api/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert response.status_code == 200
    return response.json()["accessToken"]


async def test_dashboard_is_authenticated_tenant_scoped_and_etb_native(client, session_factory):
    first_email = await create_dashboard_identity(session_factory, slug="bole")
    await create_dashboard_identity(session_factory, slug="megenagna")
    token = await token_for(client, first_email)

    response = await client.get(
        "/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["currency"] == "ETB"
    assert payload["timezone"] == "Africa/Addis_Ababa"
    assert payload["overview"]["totalPatients"] == 1
    assert Decimal(payload["overview"]["pendingPayments"]) == Decimal("1250.00")
    assert Decimal(payload["overview"]["thisMonthRevenue"]) == Decimal("1750.00")
    assert payload["recentActivity"]["upcomingAppointments"][0]["patientName"] == "Lulit Bekele"


async def test_dashboard_requires_explicit_permission(client, session_factory):
    email = await create_dashboard_identity(session_factory, slug="readonly", can_read=False)
    token = await token_for(client, email)
    response = await client.get(
        "/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


async def test_dashboard_requires_authentication(client):
    assert (await client.get("/api/dashboard/stats")).status_code == 401

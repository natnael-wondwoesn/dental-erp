import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionFactory
from app.models import (
    Appointment,
    Expense,
    Hospital,
    Invoice,
    LabOrder,
    Patient,
    Payment,
    Permission,
    Role,
    Staff,
    User,
)
from app.security.passwords import hash_password
from app.security.permissions import ROLE_GRANTS, PermissionKey

PERMISSION_DESCRIPTIONS = {
    PermissionKey.DASHBOARD_READ: "View clinic operational dashboard",
    PermissionKey.PATIENTS_READ: "View patient records",
    PermissionKey.PATIENTS_CREATE: "Create patient records",
    PermissionKey.PATIENTS_UPDATE: "Update patient records",
    PermissionKey.PATIENTS_ARCHIVE: "Archive patient records",
    PermissionKey.APPOINTMENTS_READ: "View appointments and dentist schedules",
    PermissionKey.APPOINTMENTS_MANAGE: "Book, reschedule, cancel, and progress appointments",
    PermissionKey.CLINICAL_READ: "View clinical records",
    PermissionKey.CLINICAL_WRITE: "Record assessments, diagnoses, charts, procedures, and notes",
    PermissionKey.TREATMENT_PLANS_APPROVE: "Approve treatment plans",
    PermissionKey.BILLING_READ: "View invoices, balances, receipts, and insurance",
    PermissionKey.BILLING_MANAGE: "Create and issue invoices, discounts, and insurance records",
    PermissionKey.PAYMENTS_POST: "Post payments and issue receipts",
    PermissionKey.INSURANCE_MANAGE: "Manage insurance policies and claims",
    PermissionKey.LAB_READ: "View dental laboratory cases",
    PermissionKey.LAB_MANAGE: "Create and update dental laboratory cases",
    PermissionKey.FINANCE_READ: "View clinic financial records",
    PermissionKey.FINANCE_MANAGE: "Post expenses, commissions, and ledger adjustments",
    PermissionKey.REPORTS_READ: "View clinic performance reports",
    PermissionKey.STAFF_READ: "View staff and dentist schedules",
    PermissionKey.STAFF_MANAGE: "Manage staff and schedules",
    PermissionKey.RBAC_MANAGE: "Manage roles and permissions",
}


async def seed(session: AsyncSession) -> None:
    permission_by_key: dict[str, Permission] = {}
    for key, description in PERMISSION_DESCRIPTIONS.items():
        permission = await session.scalar(select(Permission).where(Permission.key == key))
        if permission is None:
            permission = Permission(key=key, description=description)
            session.add(permission)
        permission_by_key[key] = permission
    await session.flush()

    role_by_name: dict[str, Role] = {}
    for role_name, grants in ROLE_GRANTS.items():
        role = await session.scalar(select(Role).where(Role.name == role_name))
        if role is None:
            role = Role(name=role_name, description=f"Built-in {role_name.lower()} role")
            session.add(role)
        role.permissions = [permission_by_key[grant] for grant in grants]
        role_by_name[role_name] = role
    await session.flush()

    hospital = await session.scalar(select(Hospital).where(Hospital.slug == "demo-dental"))
    if hospital is None:
        hospital = Hospital(
            name="Sunny Smile Speciality Clinic",
            slug="demo-dental",
            email="clinic@demo-dental.com",
            locale="en-ET",
            country="ET",
            currency="ETB",
            timezone="Africa/Addis_Ababa",
        )
        session.add(hospital)
        await session.flush()
    else:
        hospital.name = "Sunny Smile Speciality Clinic"
        hospital.locale = "en-ET"
        hospital.country = "ET"
        hospital.currency = "ETB"
        hospital.timezone = "Africa/Addis_Ababa"

    existing_staff = await session.scalar(select(Staff.id).where(Staff.hospital_id == hospital.id))
    if existing_staff is None:
        session.add_all(
            [
                Staff(
                    hospital_id=hospital.id,
                    employee_number="EMP-2026-0001",
                    name="Hana Tesfaye",
                    title="DENTIST",
                    specialization="Endodontics",
                    license_number="EFDA-D-10284",
                    phone="+251911102030",
                    commission_rate=Decimal("20.00"),
                    working_hours={"mon": ["08:00", "17:00"], "tue": ["08:00", "17:00"], "wed": ["08:00", "17:00"], "thu": ["08:00", "17:00"], "fri": ["08:00", "17:00"]},
                ),
                Staff(
                    hospital_id=hospital.id,
                    employee_number="EMP-2026-0002",
                    name="Abel Mekonnen",
                    title="DENTIST",
                    specialization="Prosthodontics",
                    license_number="EFDA-D-10911",
                    phone="+251922102030",
                    commission_rate=Decimal("20.00"),
                    working_hours={"mon": ["09:00", "18:00"], "tue": ["09:00", "18:00"], "wed": ["09:00", "18:00"], "thu": ["09:00", "18:00"], "sat": ["09:00", "14:00"]},
                ),
            ]
        )
        await session.flush()

    admin = await session.scalar(select(User).where(User.email == "admin@demo-dental.com"))
    if admin is None:
        admin = User(
            hospital_id=hospital.id,
            email="admin@demo-dental.com",
            password_hash=hash_password("Admin@123"),
            name="Demo Administrator",
            is_hospital_admin=True,
            roles=[role_by_name["ADMIN"]],
        )
        session.add(admin)
        await session.flush()

    patients = list(
        (await session.scalars(select(Patient).where(Patient.hospital_id == hospital.id))).all()
    )
    if not patients:
        patients = [
            Patient(
                hospital_id=hospital.id,
                patient_number=f"ET-PAT-2026-{index:04d}",
                first_name=first,
                last_name=last,
                phone=phone,
                age=age,
                gender=gender,
                city="Addis Ababa",
                state="Addis Ababa",
                address=address,
            )
            for index, (first, last, phone, age, gender, address) in enumerate(
                [
                    ("Lulit", "Bekele", "+251911234567", 29, "FEMALE", "Bole Medhanialem"),
                    ("Nahom", "Tadesse", "+251922345678", 34, "MALE", "Kazanchis"),
                    ("Meron", "Girma", "+251933456789", 26, "FEMALE", "CMC"),
                    ("Dawit", "Alemu", "+251944567890", 41, "MALE", "Sar Bet"),
                ],
                start=1,
            )
        ]
        session.add_all(patients)
        await session.flush()

    existing_appointment = await session.scalar(
        select(Appointment.id).where(Appointment.hospital_id == hospital.id)
    )
    if existing_appointment is None:
        addis = ZoneInfo("Africa/Addis_Ababa")
        now = datetime.now(addis)
        slots = [
            (9, 0, "CONFIRMED", "Dental check-up", "Chair 1"),
            (10, 30, "CHECKED_IN", "Root canal treatment", "Chair 2"),
            (12, 0, "SCHEDULED", "Teeth cleaning", "Chair 1"),
            (14, 30, "SCHEDULED", "Crown fitting", "Chair 3"),
        ]
        dentists = list((await session.scalars(select(Staff).where(Staff.hospital_id == hospital.id, Staff.title == "DENTIST").order_by(Staff.employee_number))).all())
        appointments = [
            Appointment(
                hospital_id=hospital.id,
                patient_id=patients[index].id,
                dentist_id=dentists[0].id if index < 2 else dentists[1].id,
                appointment_number=f"APT-{now.year}-{index + 1:04d}",
                dentist_name="Dr. Hana Tesfaye" if index < 2 else "Dr. Abel Mekonnen",
                appointment_type=kind,
                priority="NORMAL",
                is_virtual=False,
                scheduled_start=now.replace(hour=hour, minute=minute, second=0, microsecond=0),
                scheduled_end=now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                + timedelta(minutes=60),
                status=status,
                chair_label=chair,
                duration_minutes=60,
            )
            for index, (hour, minute, status, kind, chair) in enumerate(slots)
        ]
        session.add_all(appointments)

        invoice = Invoice(
            hospital_id=hospital.id,
            patient_id=patients[0].id,
            invoice_number=f"INV-{now.year}-0001",
            subtotal=Decimal("9200.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("9200.00"),
            balance_due=Decimal("3200.00"),
            status="PARTIALLY_PAID",
            issued_at=now - timedelta(days=2),
            due_at=now + timedelta(days=12),
        )
        session.add(invoice)
        await session.flush()
        session.add_all(
            [
                Payment(
                    hospital_id=hospital.id,
                    patient_id=patients[0].id,
                    invoice_id=invoice.id,
                    receipt_number=f"RCT-{now.year}-0001",
                    amount=Decimal("6000.00"),
                    method="TELEBIRR",
                    received_at=now,
                ),
                Payment(
                    hospital_id=hospital.id,
                    patient_id=patients[1].id,
                    receipt_number=f"RCT-{now.year}-0002",
                    amount=Decimal("1850.00"),
                    method="CASH",
                    received_at=now - timedelta(days=1),
                ),
                Expense(
                    hospital_id=hospital.id,
                    category="LABORATORY",
                    description="Zirconia crown laboratory deposit",
                    amount=Decimal("2400.00"),
                    incurred_at=now - timedelta(days=1),
                ),
                LabOrder(
                    hospital_id=hospital.id,
                    patient_id=patients[3].id,
                    order_number=f"LAB-{now.year}-0001",
                    appliance_type="Zirconia crown",
                    vendor_name="Addis Digital Dental Lab",
                    status="IN_PRODUCTION",
                    due_date=(now + timedelta(days=3)).date(),
                    cost=Decimal("4800.00"),
                ),
            ]
        )


async def main() -> None:
    async with SessionFactory() as session:
        async with session.begin():
            await seed(session)
    print("Seeded RBAC roles and demo administrator")


if __name__ == "__main__":
    asyncio.run(main())

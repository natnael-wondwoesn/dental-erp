import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionFactory
from app.models import Hospital, Permission, Role, User
from app.security.passwords import hash_password
from app.security.permissions import ROLE_GRANTS, PermissionKey

PERMISSION_DESCRIPTIONS = {
    PermissionKey.PATIENTS_READ: "View patient records",
    PermissionKey.PATIENTS_CREATE: "Create patient records",
    PermissionKey.PATIENTS_UPDATE: "Update patient records",
    PermissionKey.PATIENTS_ARCHIVE: "Archive patient records",
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
            name="Demo Dental Clinic",
            slug="demo-dental",
            email="clinic@demo-dental.com",
        )
        session.add(hospital)
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


async def main() -> None:
    async with SessionFactory() as session:
        async with session.begin():
            await seed(session)
    print("Seeded RBAC roles and demo administrator")


if __name__ == "__main__":
    asyncio.run(main())

from enum import StrEnum


class PermissionKey(StrEnum):
    PATIENTS_READ = "patients.read"
    PATIENTS_CREATE = "patients.create"
    PATIENTS_UPDATE = "patients.update"
    PATIENTS_ARCHIVE = "patients.archive"
    RBAC_MANAGE = "rbac.manage"


ROLE_GRANTS: dict[str, frozenset[PermissionKey]] = {
    "ADMIN": frozenset(PermissionKey),
    "DOCTOR": frozenset(
        {
            PermissionKey.PATIENTS_READ,
            PermissionKey.PATIENTS_CREATE,
            PermissionKey.PATIENTS_UPDATE,
        }
    ),
    "RECEPTIONIST": frozenset(
        {
            PermissionKey.PATIENTS_READ,
            PermissionKey.PATIENTS_CREATE,
            PermissionKey.PATIENTS_UPDATE,
            PermissionKey.PATIENTS_ARCHIVE,
        }
    ),
    "ACCOUNTANT": frozenset({PermissionKey.PATIENTS_READ}),
    "LAB_TECH": frozenset({PermissionKey.PATIENTS_READ}),
}

from enum import StrEnum


class PermissionKey(StrEnum):
    DASHBOARD_READ = "dashboard.read"
    PATIENTS_READ = "patients.read"
    PATIENTS_CREATE = "patients.create"
    PATIENTS_UPDATE = "patients.update"
    PATIENTS_ARCHIVE = "patients.archive"
    APPOINTMENTS_READ = "appointments.read"
    APPOINTMENTS_MANAGE = "appointments.manage"
    CLINICAL_READ = "clinical.read"
    CLINICAL_WRITE = "clinical.write"
    TREATMENT_PLANS_APPROVE = "treatment_plans.approve"
    BILLING_READ = "billing.read"
    BILLING_MANAGE = "billing.manage"
    PAYMENTS_POST = "payments.post"
    INSURANCE_MANAGE = "insurance.manage"
    LAB_READ = "lab.read"
    LAB_MANAGE = "lab.manage"
    FINANCE_READ = "finance.read"
    FINANCE_MANAGE = "finance.manage"
    REPORTS_READ = "reports.read"
    STAFF_READ = "staff.read"
    STAFF_MANAGE = "staff.manage"
    RBAC_MANAGE = "rbac.manage"


ROLE_GRANTS: dict[str, frozenset[PermissionKey]] = {
    "ADMIN": frozenset(PermissionKey),
    "DOCTOR": frozenset(
        {
            PermissionKey.DASHBOARD_READ,
            PermissionKey.PATIENTS_READ,
            PermissionKey.PATIENTS_CREATE,
            PermissionKey.PATIENTS_UPDATE,
            PermissionKey.APPOINTMENTS_READ,
            PermissionKey.APPOINTMENTS_MANAGE,
            PermissionKey.CLINICAL_READ,
            PermissionKey.CLINICAL_WRITE,
            PermissionKey.TREATMENT_PLANS_APPROVE,
            PermissionKey.BILLING_READ,
            PermissionKey.LAB_READ,
            PermissionKey.LAB_MANAGE,
            PermissionKey.REPORTS_READ,
            PermissionKey.STAFF_READ,
        }
    ),
    "RECEPTIONIST": frozenset(
        {
            PermissionKey.DASHBOARD_READ,
            PermissionKey.PATIENTS_READ,
            PermissionKey.PATIENTS_CREATE,
            PermissionKey.PATIENTS_UPDATE,
            PermissionKey.PATIENTS_ARCHIVE,
            PermissionKey.APPOINTMENTS_READ,
            PermissionKey.APPOINTMENTS_MANAGE,
            PermissionKey.BILLING_READ,
            PermissionKey.BILLING_MANAGE,
            PermissionKey.PAYMENTS_POST,
            PermissionKey.INSURANCE_MANAGE,
            PermissionKey.LAB_READ,
            PermissionKey.REPORTS_READ,
            PermissionKey.STAFF_READ,
        }
    ),
    "ACCOUNTANT": frozenset(
        {
            PermissionKey.DASHBOARD_READ,
            PermissionKey.PATIENTS_READ,
            PermissionKey.BILLING_READ,
            PermissionKey.BILLING_MANAGE,
            PermissionKey.PAYMENTS_POST,
            PermissionKey.INSURANCE_MANAGE,
            PermissionKey.FINANCE_READ,
            PermissionKey.FINANCE_MANAGE,
            PermissionKey.REPORTS_READ,
        }
    ),
    "LAB_TECH": frozenset(
        {
            PermissionKey.DASHBOARD_READ,
            PermissionKey.PATIENTS_READ,
            PermissionKey.LAB_READ,
            PermissionKey.LAB_MANAGE,
        }
    ),
}

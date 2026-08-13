from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog
from app.security.dependencies import Principal


def add_audit_log(
    session: AsyncSession,
    *,
    principal: Principal,
    request: Request,
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: dict | None = None,
    new_values: dict | None = None,
) -> None:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",", 1)[0].strip() if forwarded_for else None
    session.add(
        AuditLog(
            hospital_id=principal.hospital_id,
            user_id=principal.user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=request.headers.get("user-agent"),
        )
    )

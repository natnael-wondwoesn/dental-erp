import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app.security.permissions import PermissionKey
from app.security.tokens import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    hospital_id: uuid.UUID
    email: str
    name: str
    roles: frozenset[str]
    permissions: frozenset[str]


async def get_current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Principal:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        claims = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise unauthorized from exc

    user = await session.scalar(
        select(User).where(
            User.id == claims.user_id,
            User.hospital_id == claims.hospital_id,
            User.is_active.is_(True),
        )
    )
    if user is None:
        raise unauthorized

    roles = frozenset(role.name for role in user.roles)
    permissions = frozenset(
        permission.key for role in user.roles for permission in role.permissions
    )
    return Principal(
        user_id=user.id,
        hospital_id=user.hospital_id,
        email=user.email,
        name=user.name,
        roles=roles,
        permissions=permissions,
    )


def require_permission(
    permission: PermissionKey,
) -> Callable[[Principal], Principal]:
    async def dependency(
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> Principal:
        if permission not in principal.permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return principal

    return dependency


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]

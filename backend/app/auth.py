from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.models import Hospital, User
from app.schemas import ApiSchema
from app.security.dependencies import CurrentPrincipal
from app.security.passwords import verify_password
from app.security.tokens import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class AuthenticatedUser(ApiSchema):
    id: str
    hospital_id: str
    email: EmailStr
    name: str
    roles: list[str]
    permissions: list[str]


class LoginResponse(ApiSchema):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUser


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LoginResponse:
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    hospital_active = await session.scalar(
        select(Hospital.is_active).where(Hospital.id == user.hospital_id)
    )
    if not hospital_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinic is inactive")

    roles = sorted(role.name for role in user.roles)
    permissions = sorted({permission.key for role in user.roles for permission in role.permissions})
    return LoginResponse(
        access_token=create_access_token(user_id=user.id, hospital_id=user.hospital_id),
        expires_in=get_settings().access_token_minutes * 60,
        user=AuthenticatedUser(
            id=str(user.id),
            hospital_id=str(user.hospital_id),
            email=user.email,
            name=user.name,
            roles=roles,
            permissions=permissions,
        ),
    )


@router.get("/me", response_model=AuthenticatedUser)
async def me(principal: CurrentPrincipal) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=str(principal.user_id),
        hospital_id=str(principal.hospital_id),
        email=principal.email,
        name=principal.name,
        roles=sorted(principal.roles),
        permissions=sorted(principal.permissions),
    )

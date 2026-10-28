"""Executed in the bound Clinic CMS API container, preserving PostgreSQL RLS."""
import asyncio
import json
import sys
from uuid import UUID, uuid5, NAMESPACE_URL
from sqlalchemy import select, func, delete
from clinic.core.db import get_session_factory
from clinic.core.tenancy import TenantContext, apply_tenant_context
from clinic.core.security import hash_password
from clinic.modules.identity.models import Clinic, User, UserRole, EmployeeProfile, DoctorProfile

x = json.load(sys.stdin)

async def main():
    clinic_id = UUID(x['tenantId'])
    async with get_session_factory()() as s:
        async with s.begin():
            await apply_tenant_context(s, TenantContext(clinic_id))
            clinic = await s.scalar(select(Clinic).where(Clinic.id == clinic_id).with_for_update())
            if clinic is None:
                raise ValueError('Clinic binding not found')
            async def view(user):
                roles = list((await s.scalars(select(UserRole.role).where(UserRole.user_id == user.id, UserRole.clinic_id == clinic_id))).all())
                return {'id':str(user.id),'name':user.full_name,'email':user.email,'role':roles[0] if roles else '', 'roles':roles,'isActive':user.is_active}
            if x['action'] == 'USER_LIST':
                users = (await s.scalars(select(User).where(User.clinic_id == clinic_id).order_by(User.full_name).limit(500))).all()
                return {'users':[await view(u) for u in users]}
            role = x.get('role')
            if role is not None and role not in {'admin','doctor','receptionist','cashier'}:
                raise ValueError('Unsupported role')
            if x['action'] == 'USER_CREATE':
                user_id = uuid5(NAMESPACE_URL, 'owner-operation:'+x['operationId'])
                existing = await s.get(User,user_id)
                if existing:
                    return {'user':await view(existing)}
                user = User(id=user_id,clinic_id=clinic_id,email=x['email'],full_name=x['name'],password_hash=hash_password(x['password']),is_active=True)
                s.add(user)
                await s.flush()
                s.add(UserRole(user_id=user_id,clinic_id=clinic_id,role=role))
                s.add(EmployeeProfile(id=uuid5(NAMESPACE_URL,'owner-profile:'+x['operationId']),clinic_id=clinic_id,user_id=user_id,employee_number='OWN'+user_id.hex[:20]))
                if role == 'doctor':
                    s.add(DoctorProfile(id=uuid5(NAMESPACE_URL,'owner-doctor:'+x['operationId']),clinic_id=clinic_id,user_id=user_id))
                await s.flush()
                return {'user':await view(user)}
            user = await s.scalar(select(User).where(User.id == UUID(x['userId']),User.clinic_id == clinic_id))
            if user is None:
                raise ValueError('User not found in this clinic')
            current_roles = (await view(user))['roles']
            if user.is_active and 'admin' in current_roles and (x.get('isActive') is False or (role is not None and role != 'admin')):
                other = await s.scalar(select(func.count(User.id)).join(UserRole,UserRole.user_id == User.id).where(User.clinic_id == clinic_id,User.is_active.is_(True),User.id != user.id,UserRole.role == 'admin',UserRole.clinic_id == clinic_id))
                if not other:
                    raise ValueError('Keep at least one active clinic administrator')
            if role is not None:
                await s.execute(delete(UserRole).where(UserRole.user_id == user.id,UserRole.clinic_id == clinic_id))
                s.add(UserRole(user_id=user.id,clinic_id=clinic_id,role=role))
                if role == 'doctor' and not await s.scalar(select(DoctorProfile.id).where(DoctorProfile.user_id == user.id,DoctorProfile.clinic_id == clinic_id)):
                    s.add(DoctorProfile(id=uuid5(NAMESPACE_URL,'owner-doctor:'+str(user.id)),clinic_id=clinic_id,user_id=user.id))
            if 'isActive' in x:
                user.is_active=x['isActive']
                profile=await s.scalar(select(EmployeeProfile).where(EmployeeProfile.user_id == user.id,EmployeeProfile.clinic_id == clinic_id))
                if profile:profile.employment_status='active' if user.is_active else 'terminated'
            await s.flush()
            return {'user':await view(user)}

try:
    print(json.dumps(asyncio.run(main())))
except ValueError as exc:
    print(str(exc),file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    # SQL/ORM exceptions may include credentials in parameters; never emit them.
    print('User operation failed: duplicate email or unavailable account schema' if type(exc).__name__=='IntegrityError' else 'User operation failed; check product schema compatibility',file=sys.stderr)
    sys.exit(1)

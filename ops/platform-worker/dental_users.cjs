// Executed inside the bound clinic container. Input only through stdin.
const { PrismaClient } = require('@prisma/client')
const crypto = require('node:crypto')
const p = new PrismaClient()
const x = JSON.parse(require('node:fs').readFileSync(0, 'utf8'))
const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECH', 'ACCOUNTANT']
const selected = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  isHospitalAdmin: true,
}
;(async () => {
  let result
  if (x.action === 'USER_LIST') {
    result = {
      users: await p.user.findMany({
        where: { hospitalId: x.tenantId, isPlatformOwner: false },
        select: selected,
        orderBy: { name: 'asc' },
        take: 500,
      }),
    }
  } else {
    result = await p.$transaction(async (tx) => {
      // Clinic row lock serializes administrator changes and protects last admin.
      const clinics =
        await tx.$queryRaw`SELECT id FROM Hospital WHERE id = ${x.tenantId} FOR UPDATE`
      if (clinics.length !== 1) throw Error('Clinic binding not found')
      if (x.action === 'USER_CREATE') {
        if (!roles.includes(x.role)) throw Error('Unsupported role')
        const id = 'owner_' + x.operationId
        const existing = await tx.user.findFirst({
          where: { id, hospitalId: x.tenantId, isPlatformOwner: false },
          select: selected,
        })
        if (existing) return { user: existing }
        const [firstName, ...rest] = x.name.split(' ')
        return {
          user: await tx.user.create({
            data: {
              id,
              hospitalId: x.tenantId,
              name: x.name,
              email: x.email,
              phone: x.phone || null,
              password: x.passwordHash,
              role: x.role,
              isHospitalAdmin: x.role === 'ADMIN',
              isPlatformOwner: false,
              isActive: true,
              mustChangePassword: true,
              staff: {
                create: {
                  hospitalId: x.tenantId,
                  employeeId:
                    'OWN-' + crypto.createHash('sha256').update(id).digest('hex').slice(0, 20),
                  firstName,
                  lastName: rest.join(' '),
                  phone: x.phone || '',
                  email: x.email,
                  isActive: true,
                },
              },
            },
            select: selected,
          }),
        }
      }
      const user = await tx.user.findFirst({
        where: { id: x.userId, hospitalId: x.tenantId, isPlatformOwner: false },
      })
      if (!user) throw Error('User not found in this clinic')
      if (x.role !== undefined && !roles.includes(x.role)) throw Error('Unsupported role')
      if (
        user.role === 'ADMIN' &&
        user.isActive &&
        (x.isActive === false || (x.role !== undefined && x.role !== 'ADMIN'))
      ) {
        const other = await tx.user.count({
          where: {
            hospitalId: x.tenantId,
            role: 'ADMIN',
            isActive: true,
            isPlatformOwner: false,
            id: { not: user.id },
          },
        })
        if (!other) throw Error('Keep at least one active clinic administrator')
      }
      if (x.action === 'USER_RESET_PASSWORD') {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { password: x.passwordHash, mustChangePassword: true },
          select: selected,
        })
        return { user: updated, message: 'Password reset; the user must change it at next sign-in' }
      }
      if (x.action === 'USER_DELETE') {
        if (user.role === 'ADMIN' && user.isActive) {
          const other = await tx.user.count({
            where: {
              hospitalId: x.tenantId,
              role: 'ADMIN',
              isActive: true,
              isPlatformOwner: false,
              id: { not: user.id },
            },
          })
          if (!other) throw Error('Keep at least one active clinic administrator')
        }
        try {
          await tx.staff.deleteMany({ where: { userId: user.id, hospitalId: x.tenantId } })
          await tx.user.delete({ where: { id: user.id } })
        } catch (e) {
          if (e.code === 'P2003' || e.code === 'P2014')
            throw Error('User has clinical records; disable the account instead')
          throw e
        }
        return { deleted: user.id, message: 'User deleted' }
      }
      const data = {
        ...(x.name !== undefined ? { name: x.name } : {}),
        ...(x.email !== undefined ? { email: x.email } : {}),
        ...(x.role !== undefined ? { role: x.role, isHospitalAdmin: x.role === 'ADMIN' } : {}),
        ...(x.isActive !== undefined ? { isActive: x.isActive } : {}),
      }
      const updated = await tx.user.update({ where: { id: user.id }, data, select: selected })
      if (x.name !== undefined || x.email !== undefined) {
        const [firstName, ...rest] = (x.name ?? user.name).split(' ')
        await tx.staff.updateMany({
          where: { userId: user.id, hospitalId: x.tenantId },
          data: {
            ...(x.name !== undefined ? { firstName, lastName: rest.join(' ') } : {}),
            ...(x.email !== undefined ? { email: x.email } : {}),
          },
        })
      }
      if (x.isActive !== undefined)
        await tx.staff.updateMany({
          where: { userId: user.id, hospitalId: x.tenantId },
          data: { isActive: x.isActive },
        })
      return { user: updated }
    })
  }
  console.log(JSON.stringify(result))
})()
  .catch((e) => {
    console.error(
      e.code === 'P2002'
        ? 'Email already exists'
        : e.code
          ? 'User operation failed (' + e.code + ')'
          : [
                'Clinic binding not found',
                'Unsupported role',
                'User not found in this clinic',
                'Keep at least one active clinic administrator',
                'User has clinical records; disable the account instead',
              ].includes(e.message)
            ? e.message
            : 'Clinic account schema validation failed'
    )
    process.exitCode = 1
  })
  .finally(() => p.$disconnect())

import { z } from 'zod'

export const ownerOperationActions = [
  'STATUS',
  'USER_LIST',
  'USER_CREATE',
  'USER_UPDATE',
  'DB_STOP',
  'DB_START',
  'DEMO_SEED',
  'DEMO_RESET',
] as const
export const productUserRoles: Record<string, readonly string[]> = {
  'dental-erp': ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECH', 'ACCOUNTANT'],
  'clinic-cms': ['admin', 'doctor', 'receptionist', 'cashier'],
}
const reason = z.string().trim().min(3).max(500)
export const ownerOperationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('STATUS') }).strict(),
  z.object({ action: z.literal('USER_LIST') }).strict(),
  z
    .object({
      action: z.literal('USER_CREATE'),
      name: z.string().trim().min(2).max(120),
      email: z
        .email()
        .max(255)
        .transform((s) => s.toLowerCase()),
      role: z.string().min(1).max(40),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('USER_UPDATE'),
      userId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      role: z.string().min(1).max(40).optional(),
      isActive: z.boolean().optional(),
      reason,
    })
    .strict()
    .refine(
      (v) => v.role !== undefined || v.isActive !== undefined,
      'Choose a role or active status'
    ),
  z.object({ action: z.literal('DB_STOP'), confirmHostname: z.string().min(1), reason }).strict(),
  z.object({ action: z.literal('DB_START'), reason }).strict(),
  z.object({ action: z.literal('DEMO_SEED'), reason }).strict(),
  z.object({ action: z.literal('DEMO_RESET'), reason }).strict(),
])

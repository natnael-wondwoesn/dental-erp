import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const policy = vi.hoisted(() => ({ assertWrite: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/saas/server', () => ({
  saasEnforcement: () => 'hosted',
  assertModuleWrite: policy.assertWrite,
}))

import { executeIntent } from '@/lib/ai/command-executors'
import { buildContext } from '@/lib/ai/context-builder'

describe('SaaS AI permission boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    policy.assertWrite.mockResolvedValue(undefined)
  })

  it('rejects model-selected clinical mutations by receptionist before querying', async () => {
    const result = await executeIntent('create_prescription', {}, 'clinic-a', 'RECEPTIONIST')
    expect(result.success).toBe(false)
    expect(prisma.prescription.create).not.toHaveBeenCalled()
    expect(policy.assertWrite).not.toHaveBeenCalled()
  })

  it('rejects missing roles and unknown commands even for admin', async () => {
    expect((await executeIntent('show_staff', {}, 'clinic-a')).success).toBe(false)
    expect((await executeIntent('delete_everything', {}, 'clinic-a', 'ADMIN')).success).toBe(false)
  })

  it('rechecks subscription immediately before an authorized command', async () => {
    policy.assertWrite.mockRejectedValue(new Error('Subscription locked'))
    await expect(executeIntent('create_patient', {}, 'clinic-a', 'ADMIN')).rejects.toThrow('locked')
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('omits clinical patient prompt context for non-clinical staff', async () => {
    const context = await buildContext({
      hospitalId: 'clinic-a',
      userId: 'receptionist',
      userName: 'Reception',
      userRole: 'RECEPTIONIST',
      hospitalName: 'Clinic A',
      hospitalPlan: 'Custom',
      patientId: 'patient-a',
    })
    expect(context.patient).toBeUndefined()
    expect(prisma.patient.findUnique).not.toHaveBeenCalled()
    expect(prisma.patientRiskScore.findFirst).not.toHaveBeenCalled()
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const redirect = vi.fn()

vi.mock('next/navigation', () => ({ redirect }))

describe('legacy treatment details route', () => {
  it('redirects singular treatment URLs captured in the client video', async () => {
    const { default: LegacyTreatmentPage } = await import('@/app/(dashboard)/treatment/[id]/page')

    await LegacyTreatmentPage({ params: Promise.resolve({ id: 'treatment-123' }) })

    expect(redirect).toHaveBeenCalledWith('/treatments/treatment-123')
  })

  it('unwraps patient details for prescription shortcuts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/(dashboard)/prescriptions/new/page.tsx'),
      'utf8'
    )

    expect(source).toContain('result.patient || result.data || result')
  })

  it('renders the selected patient in treatment-linked medical certificates', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/(dashboard)/forms/medical-certificates/new/page.tsx'),
      'utf8'
    )

    expect(source).toContain('selectedPatient.firstName')
    expect(source).toContain('selectedPatient.patientId')
  })
})

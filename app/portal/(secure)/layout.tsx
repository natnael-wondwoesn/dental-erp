export const metadata = {
  title: 'Patient Portal',
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [patient, brand] = await Promise.all([getAuthenticatedPatient(), publicBrand()])
  const login = '/portal/login' + (brand?.slug ? `?clinic=${encodeURIComponent(brand.slug)}` : '')
  if (!patient || (brand && brand.tenantId !== patient.hospitalId)) redirect(login)
  const hospital = await prisma.hospital.findUnique({
    where: { id: patient.hospitalId },
    select: { name: true, logo: true, slug: true, isActive: true },
  })
  if (!hospital?.isActive) redirect(login)
  return (
    <PortalShell
      patient={{
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        patientId: patient.patientId,
        phone: patient.phone,
      }}
      hospital={hospital}
    >
      {children}
    </PortalShell>
  )
}
import { redirect } from 'next/navigation'
import { getAuthenticatedPatient } from '@/lib/patient-auth'
import { prisma } from '@/lib/prisma'
import { publicBrand } from '@/lib/saas/public-brand'
import { PortalShell } from '@/components/portal/portal-shell'

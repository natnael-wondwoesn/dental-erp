import { redirect } from 'next/navigation'

export default async function LegacyTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/treatments/${id}`)
}

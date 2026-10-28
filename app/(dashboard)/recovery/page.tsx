'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Patient = {
  id: string
  firstName: string
  lastName: string
  patientId: string
  phone: string
  treatments?: Array<{ id: string; procedure?: { name: string }; status: string }>
  prescriptions?: Array<{
    id: string
    diagnosis: string
    medications: Array<{
      id: string
      medicationName: string
      dosage: string
      frequency: string
      duration: string
    }>
  }>
}

export default function RecoveryPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(null)
  const [error, setError] = useState('')
  async function load(query: string) {
    setError('')
    try {
      const response = await fetch(`/api/recovery?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Records could not be loaded')
      const result = await response.json()
      if (result.patient) setSelected(result.patient)
      else setPatients(result.patients)
    } catch (err) {
      setError(String(err))
    }
  }
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Record recovery</h1>
      <p>
        Read-only patient records remain available during subscription or license recovery. Clinical
        detail follows your staff role.
      </p>
      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          void load(`search=${encodeURIComponent(String(data.get('search') || ''))}`)
        }}
      >
        <Input
          name="search"
          aria-label="Patient name, number or phone"
          placeholder="Patient name, number or phone"
        />
        <Button>Search records</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-5 md:grid-cols-2">
        <ul className="space-y-2">
          {patients.map((patient) => (
            <li key={patient.id}>
              <button
                className="w-full rounded-xl border bg-white p-4 text-left"
                onClick={() => load(`id=${encodeURIComponent(patient.id)}`)}
              >
                {patient.firstName} {patient.lastName} · {patient.patientId}
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <article className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-xl font-semibold">
              {selected.firstName} {selected.lastName}
            </h2>
            <p>
              {selected.patientId} · {selected.phone}
            </p>
            {selected.treatments && (
              <div>
                <h3 className="font-semibold">Treatment history</h3>
                {selected.treatments.map((treatment) => (
                  <p key={treatment.id}>
                    {treatment.procedure?.name} · {treatment.status}
                  </p>
                ))}
              </div>
            )}
            {selected.prescriptions?.map((prescription) => (
              <div key={prescription.id}>
                <h3 className="font-semibold">{prescription.diagnosis || 'Prescription'}</h3>
                {prescription.medications.map((medication) => (
                  <p key={medication.id}>
                    {medication.medicationName} · {medication.dosage} · {medication.frequency} ·{' '}
                    {medication.duration}
                  </p>
                ))}
              </div>
            ))}
          </article>
        )}
      </div>
    </section>
  )
}

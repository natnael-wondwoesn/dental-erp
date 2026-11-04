'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const edit = useSearchParams().get('edit') === '1'
  const [supplier, setSupplier] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/inventory/suppliers/${id}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Supplier not found'))
      )
      .then((body) => setSupplier(body.data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6">Loading supplier…</div>
  if (!supplier) return <div className="p-6">Supplier not found.</div>

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{supplier.code}</p>
          <h1 className="text-3xl font-bold">{supplier.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-md border px-4 py-2" href="/inventory/suppliers">
            Back
          </Link>
          {!edit && (
            <Link
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              href={`/inventory/suppliers/${id}?edit=1`}
            >
              Edit
            </Link>
          )}
        </div>
      </div>
      <div className="grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-2">
        {[
          'contactPerson',
          'phone',
          'alternatePhone',
          'email',
          'address',
          'city',
          'paymentTerms',
          'status',
        ].map((field) => (
          <div key={field}>
            <p className="text-sm capitalize text-muted-foreground">
              {field.replace(/([A-Z])/g, ' $1')}
            </p>
            <p className="mt-1 font-medium">{supplier[field] || '—'}</p>
          </div>
        ))}
      </div>
      {edit && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Editing supplier records is temporarily restricted. Create corrections through an
          administrator until audited update controls are enabled.
        </p>
      )}
    </div>
  )
}

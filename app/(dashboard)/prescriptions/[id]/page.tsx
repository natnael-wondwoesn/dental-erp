'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Mail, Printer, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'

interface PrescriptionSummary {
  id: string
  prescriptionNo: string
  patient: { firstName: string; lastName: string; email: string | null }
}

export default function PrescriptionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [prescription, setPrescription] = useState<PrescriptionSummary | null>(null)
  const [email, setEmail] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    Promise.all([
      fetch(`/api/prescriptions/${id}`).then((response) =>
        response.json().then((result) => ({ response, result }))
      ),
      fetch(`/api/prescriptions/${id}/print`).then((response) => {
        if (!response.ok) throw new Error('Failed to load printable prescription')
        return response.text()
      }),
    ])
      .then(([{ response, result }, html]) => {
        if (!response.ok) throw new Error(result.error || 'Failed to load prescription')
        setPrescription(result.data)
        setEmail(result.data.patient.email || '')
        setPreviewHtml(html)
      })
      .catch((cause) =>
        toast({
          variant: 'destructive',
          title: 'Error',
          description: cause instanceof Error ? cause.message : 'Failed to load prescription',
        })
      )
      .finally(() => setLoading(false))
  }, [id, toast])

  const printPrescription = () => {
    const frame = document.getElementById('prescription-paper-preview') as HTMLIFrameElement | null
    frame?.contentWindow?.focus()
    frame?.contentWindow?.print()
  }

  const handleDelete = async () => {
    const approved = await confirm({
      title: 'Delete Prescription',
      description: 'Delete this prescription? This action cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!approved) return
    const response = await fetch(`/api/prescriptions/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast({ variant: 'destructive', title: 'Could not delete prescription' })
      return
    }
    toast({ title: 'Prescription deleted' })
    router.push('/prescriptions')
  }

  const handleEmail = async () => {
    if (!email) {
      toast({ variant: 'destructive', title: 'Enter the patient email address' })
      return
    }
    setSending(true)
    try {
      const response = await fetch(`/api/prescriptions/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to email prescription')
      toast({ title: 'Prescription emailed', description: `Sent to ${email}` })
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'Email failed',
        description: cause instanceof Error ? cause.message : 'Failed to email prescription',
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!prescription) {
    return <div className="p-8 text-center text-muted-foreground">Prescription not found.</div>
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/prescriptions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold">{prescription.prescriptionNo}</p>
            <p className="text-sm text-muted-foreground">
              {prescription.patient.firstName} {prescription.patient.lastName}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="patient@example.com"
            className="sm:w-64"
          />
          <Button variant="outline" onClick={handleEmail} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}{' '}
            Email patient
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
          <Button onClick={printPrescription} disabled={!previewHtml}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-[#dfe5ec] shadow-inner">
        <iframe
          id="prescription-paper-preview"
          title={`Prescription ${prescription.prescriptionNo}`}
          srcDoc={previewHtml}
          className="h-[calc(100vh-13rem)] min-h-[760px] w-full bg-white"
        />
      </div>
      {ConfirmDialogComponent}
    </div>
  )
}

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Mail, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MedicalCertificateData } from '@/lib/clinical-forms/medical-certificate'

export default function MedicalCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<MedicalCertificateData | null>(null)
  const [email, setEmail] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    Promise.all([
      fetch(`/api/clinical-forms/medical-certificates/${id}`).then((response) =>
        response.json().then((result) => ({ response, result }))
      ),
      fetch(`/api/clinical-forms/medical-certificates/${id}/print`).then((response) => {
        if (!response.ok) throw new Error('Failed to load printable certificate')
        return response.text()
      }),
    ])
      .then(([{ response, result }, html]) => {
        if (!response.ok) throw new Error(result.error)
        setData(result.certificate.data)
        setEmail(result.certificate.data.patientEmail || '')
        setPreviewHtml(html)
      })
      .catch((cause) =>
        toast.error(cause instanceof Error ? cause.message : 'Failed to load certificate')
      )
      .finally(() => setLoading(false))
  }, [id])

  const printCertificate = () => {
    const frame = document.getElementById('medical-certificate-preview') as HTMLIFrameElement | null
    frame?.contentWindow?.focus()
    frame?.contentWindow?.print()
  }

  const sendEmail = async () => {
    if (!email) return toast.error('Enter the patient email address')
    setSending(true)
    try {
      const response = await fetch(`/api/clinical-forms/medical-certificates/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to send email')
      toast.success('Medical certificate emailed to patient')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!data)
    return (
      <div className="p-8 text-center text-muted-foreground">Medical certificate not found.</div>
    )

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/forms/medical-certificates')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold">{data.certificateNo}</p>
            <p className="text-sm text-muted-foreground">{data.patientFullName}</p>
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
          <Button variant="outline" onClick={sendEmail} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}{' '}
            Email patient
          </Button>
          <Button onClick={printCertificate} disabled={!previewHtml}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-[#dfe5ec] shadow-inner">
        <iframe
          id="medical-certificate-preview"
          title={`Medical certificate ${data.certificateNo}`}
          srcDoc={previewHtml}
          className="h-[calc(100vh-13rem)] min-h-[760px] w-full bg-white"
        />
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, FileHeart, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CertificateRow {
  id: string
  createdAt: string
  status: string
  data: { certificateNo?: string; examinedAt?: string; recommendation?: string }
  patient: { patientId: string; firstName: string; lastName: string; email: string | null } | null
}

export default function MedicalCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/clinical-forms/medical-certificates')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load certificates')
      setCertificates(result.certificates || [])
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // The request callback owns the state transition after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <FileHeart className="h-8 w-8 text-primary" /> Medical certificates
          </h1>
          <p className="mt-2 text-muted-foreground">
            Treatment and medical-leave certificates issued by doctors.
          </p>
        </div>
        <Button asChild>
          <Link href="/forms/medical-certificates/new">
            <Plus className="mr-2 h-4 w-4" /> New certificate
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="py-16 text-center">
              <FileHeart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-medium">No medical certificates yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Prepare the first certificate from a patient record.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Examined</TableHead>
                  <TableHead className="hidden lg:table-cell">Recommendation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell className="font-mono text-sm">
                      {certificate.data.certificateNo || certificate.id.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {certificate.patient
                          ? `${certificate.patient.firstName} ${certificate.patient.lastName}`
                          : 'Unknown patient'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {certificate.patient?.patientId}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {certificate.data.examinedAt ||
                        new Date(certificate.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate lg:table-cell">
                      {certificate.data.recommendation}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{certificate.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/forms/medical-certificates/${certificate.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

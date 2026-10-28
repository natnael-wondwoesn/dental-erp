'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  FileHeart,
  FileText,
  FlaskConical,
  Mail,
  Printer,
  ReceiptText,
  ScrollText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const formTypes = [
  {
    title: 'Patient treatment consent',
    description: 'Print the clinic-branded bilingual patient and guardian treatment consent form.',
    icon: ScrollText,
    href: '/api/clinical-forms/printables/consent',
    action: 'Open and print consent',
    tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-300',
    printable: true,
  },
  {
    title: 'Dental laboratory order',
    description:
      'Print the laboratory work order with case, material, shade and teeth-position fields.',
    icon: FlaskConical,
    href: '/api/clinical-forms/printables/laboratory-order',
    action: 'Open and print lab order',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300',
    printable: true,
  },
  {
    title: 'Cash sales attachment',
    description: 'Print the itemized attachment sheet used with the corresponding fiscal receipt.',
    icon: ReceiptText,
    href: '/api/clinical-forms/printables/cash-sales-attachment',
    action: 'Open and print attachment',
    tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300',
    printable: true,
  },
  {
    title: 'Patient treatment sheet',
    description:
      'Print the clinic clinical sheet for vitals, history, examination, assessment and plan.',
    icon: FileText,
    href: '/api/clinical-forms/printables/treatment-sheet',
    action: 'Open and print treatment sheet',
    tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300',
    printable: true,
  },
  {
    title: 'Medical certificates',
    description:
      'Prepare medical leave and treatment certificates using patient records, then print or email them.',
    icon: FileHeart,
    href: '/forms/medical-certificates',
    action: 'Open certificates',
    tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300',
  },
  {
    title: 'Prescription paper',
    description:
      'Create medication orders with diagnosis, dosage, frequency, duration and prescriber details.',
    icon: ClipboardList,
    href: '/prescriptions',
    action: 'Open prescriptions',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300',
  },
]

export default function ClinicalFormsPage() {
  const [showBerhanuGuides, setShowBerhanuGuides] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/tenant-branding', { cache: 'no-store' })
      .then((response) => response.json())
      .then((profile) => {
        if (active) setShowBerhanuGuides(/berhanu.*belta/i.test(profile?.name || ''))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <FileText className="h-4 w-4" /> Clinical documents
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Doctor-prepared documents that are linked to the patient record and ready for email or
            A4 printing.
          </p>
        </div>
        <Button asChild>
          <Link href="/forms/medical-certificates/new">Prepare medical certificate</Link>
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {showBerhanuGuides && (
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader>
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/35 dark:text-indigo-300">
                <ScrollText className="h-6 w-6" />
              </div>
              <CardTitle>Patient guidance notices</CardTitle>
              <CardDescription className="min-h-12 leading-6">
                Print the two original Amharic clinic notices with Dr. Berhanu Belta branding.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline" className="w-full">
                <Link
                  href="/api/clinical-forms/printables/berhanu-orthodontic-guidance"
                  target="_blank"
                >
                  Open orthodontic guidance
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link
                  href="/api/clinical-forms/printables/berhanu-pre-treatment-notice"
                  target="_blank"
                >
                  Open before-treatment notice
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {formTypes.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title} className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader>
                <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="min-h-12 leading-6">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href={item.href} target={item.printable ? '_blank' : undefined}>
                    {item.action}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="flex gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Patient-linked</p>
              <p className="text-sm text-muted-foreground">
                Names, card numbers and demographics are prefilled.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Printer className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">A4 print ready</p>
              <p className="text-sm text-muted-foreground">
                Consistent clinic letterhead and clean print margins.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Email delivery</p>
              <p className="text-sm text-muted-foreground">
                Send the same document directly to the patient.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

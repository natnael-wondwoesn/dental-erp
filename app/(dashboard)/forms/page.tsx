'use client'

import Link from 'next/link'
import { ClipboardList, FileHeart, FileText, Mail, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const formTypes = [
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
                  <Link href={item.href}>{item.action}</Link>
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

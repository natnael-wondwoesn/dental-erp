'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  MoreHorizontal,
  Eye,
  Edit,
  FileText,
  Phone,
  Mail,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ErpModuleOverview } from '@/components/dashboard/erp-overview'
import { ExportMenu } from '@/components/ui/export-menu'
import { useLanguage } from '@/lib/i18n'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  gender: string
  age: number
  bloodGroup: string
  city: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function PatientsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('all')
  const [bloodGroupFilter, setBloodGroupFilter] = useState('all')

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (genderFilter && genderFilter !== 'all') params.append('gender', genderFilter)
      if (bloodGroupFilter && bloodGroupFilter !== 'all')
        params.append('bloodGroup', bloodGroupFilter)

      const response = await fetch(`/api/patients?${params}`)
      if (!response.ok) throw new Error('Failed to fetch patients')

      const data = await response.json()
      setPatients(data.patients)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [pagination.page, search, genderFilter, bloodGroupFilter])

  const getGenderBadge = (gender: string) => {
    const colors = {
      MALE: 'bg-blue-100 text-blue-700',
      FEMALE: 'bg-pink-100 text-pink-700',
      OTHER: 'bg-purple-100 text-purple-700',
    }
    return (
      <Badge
        className={`${colors[gender as keyof typeof colors] || 'bg-muted text-muted-foreground'} border-0`}
      >
        {gender}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <ErpModuleOverview
        moduleId="patients"
        eyebrow={t('Patient ERP')}
        title={t('Patient records for intake, follow-up, and longitudinal history')}
        description={t(
          'Keep registration, family contact details, clinical history, and billing context in one faster-working patient workspace.'
        )}
        compact
        showActions={false}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('Patients')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{t('Manage patient records, history, and contact details.')}</span>
            {!loading && pagination.total > 0 && (
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {pagination.total} active records
              </Badge>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <ExportMenu
            filename="patients"
            getData={() =>
              patients.map((p) => ({
                'Patient ID': p.patientId,
                'First Name': p.firstName,
                'Last Name': p.lastName,
                Phone: p.phone,
                Email: p.email || '',
                Gender: p.gender,
                Age: p.age,
                'Blood Group': p.bloodGroup || '',
                City: p.city || '',
              }))
            }
          />
          <Link href="/patients/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Register patient
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('Search by name, patient ID, phone, or email')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Gender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Genders')}</SelectItem>
                  <SelectItem value="MALE">{t('Male')}</SelectItem>
                  <SelectItem value="FEMALE">{t('Female')}</SelectItem>
                  <SelectItem value="OTHER">{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Blood Group')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Blood Groups')}</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Search with local phone numbers, patient IDs, or family names to reach records faster.
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Patient ID')}</TableHead>
                      <TableHead>{t('Name')}</TableHead>
                      <TableHead>{t('Contact')}</TableHead>
                      <TableHead>{t('Gender')}</TableHead>
                      <TableHead>{t('Age')}</TableHead>
                      <TableHead>{t('Blood Group')}</TableHead>
                      <TableHead>{t('Location')}</TableHead>
                      <TableHead className="text-right">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : patients.length === 0 ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <User className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">{t('No patients found')}</p>
              <Link href="/patients/new">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Patient
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {patients.map((patient) => (
                  <Card key={patient.id} className="border-[#e7edf5] shadow-sm">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {patient.patientId}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-medium">
                                {patient.firstName} {patient.lastName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {patient.city || 'Location not set'}
                              </p>
                            </div>
                          </div>
                        </div>
                        {getGenderBadge(patient.gender)}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{patient.phone}</span>
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-2 break-all text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span>{patient.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-muted/50 p-3">
                            <div className="text-muted-foreground">{t('Age')}</div>
                            <div className="mt-1 font-medium">{patient.age} years</div>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-3">
                            <div className="text-muted-foreground">{t('Blood')}</div>
                            <div className="mt-1 font-medium">{patient.bloodGroup || 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => router.push(`/patients/${patient.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View details
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => router.push(`/patients/${patient.id}/medical-history`)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Medical history
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Patient ID')}</TableHead>
                      <TableHead>{t('Name')}</TableHead>
                      <TableHead>{t('Contact')}</TableHead>
                      <TableHead>{t('Gender')}</TableHead>
                      <TableHead>{t('Age')}</TableHead>
                      <TableHead>{t('Blood Group')}</TableHead>
                      <TableHead>{t('Location')}</TableHead>
                      <TableHead className="text-right">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <div className="font-medium">{patient.patientId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="font-medium">
                              {patient.firstName} {patient.lastName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {patient.phone}
                            </div>
                            {patient.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {patient.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getGenderBadge(patient.gender)}</TableCell>
                        <TableCell>
                          <div className="text-sm">{patient.age} years</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{patient.bloodGroup || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {patient.city || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/patients/${patient.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/patients/${patient.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/patients/${patient.id}/medical-history`)
                                }
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Medical History
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} patients
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

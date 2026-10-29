import catalog from '@/config/saas-modules.json'

export type ModuleId = keyof typeof catalog
export const moduleIds = Object.keys(catalog) as ModuleId[]

export function validateModules(grants: string[]): ModuleId[] {
  const selected = new Set(grants)
  if (!selected.has('core')) throw new Error('Core module is required')
  for (const grant of grants) {
    if (!Object.hasOwn(catalog, grant)) throw new Error(`Unknown module: ${grant}`)
    for (const dependency of catalog[grant as ModuleId]) {
      if (!selected.has(dependency)) throw new Error(`${grant} requires ${dependency}`)
    }
  }
  return [...selected].sort() as ModuleId[]
}

/** Ordered from specific to general. Unknown API routes fail closed. */
export function modulesForPath(rawPath: string): ModuleId[] | null {
  let pathname: string
  try {
    pathname = decodeURIComponent(rawPath).replace(/\/$/, '')
  } catch {
    return null
  }
  if (pathname.split('/').some((part) => part === '..' || part === '.')) return null
  const path = pathname.replace(/^\/api(?=\/)/, '')
  const is = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
  if (/^\/patients\/[^/]+\/braces(?:\/|$)/.test(path) || is('/braces'))
    return ['braces', 'clinical']
  if (/^\/patients\/[^/]+\/(medical-history|documents)(?:\/|$)/.test(path)) return ['clinical']
  if (/^\/staff\/[^/]+\/performance$/.test(path)) return ['staff', 'appointments', 'clinical']
  if (is('/billing/unbilled-treatments')) return ['billing', 'clinical']
  if (is('/clinical-forms/medical-certificates')) return ['forms', 'clinical']
  if (is('/data-import/ai-mapping')) return ['data_import', 'ai']
  if (/^\/prescriptions\/[^/]+\/email$/.test(path)) return ['clinical', 'communications']
  if (is('/integrations/google-calendar')) return ['appointments']
  if (/^\/patients\/[^/]+\/recalls(?:\/|$)/.test(path))
    return ['clinical', 'appointments', 'communications']
  if (/^\/patients\/[^/]+\/timeline$/.test(path))
    return ['patients', 'appointments', 'clinical', 'billing', 'lab', 'forms']
  if (rawPath.startsWith('/api/') && (is('/dashboard') || is('/search')))
    return [
      'patients',
      'appointments',
      'clinical',
      'billing',
      'finance',
      'inventory',
      'lab',
      'staff',
      'insurance',
    ]
  if (path === '/patient-portal/dashboard') return ['portal', 'appointments', 'clinical', 'billing']
  if (is('/reports')) return ['reports']
  if (
    is('/billing/insurance') ||
    is('/insurance-claims') ||
    is('/insurance-providers') ||
    is('/pre-authorizations') ||
    /\/patients\/[^/]+\/insurance/.test(path)
  )
    return ['insurance']
  if (is('/staff/doctors')) return ['appointments']
  if (is('/settings/ai') || is('/ai/usage')) return ['ai']
  if (is('/ai/clinical')) return ['ai', 'clinical']
  if (is('/ai/claim-analysis')) return ['ai', 'insurance']
  if (is('/ai/no-show-risk')) return ['ai', 'appointments']
  if (is('/ai/inventory-forecast')) return ['ai', 'inventory']
  if (is('/ai/cashflow-forecast')) return ['ai', 'billing', 'finance']
  if (is('/ai/patient-segments')) return ['ai', 'crm']
  if (is('/ai/pricing-suggestions') || is('/settings/pricing')) return ['ai', 'clinical', 'billing']
  if (
    is('/settings/ai') ||
    is('/settings/pricing') ||
    is('/chat') ||
    is('/ai') ||
    is('/webhooks')
  ) {
    // Legacy AI context/executors span multiple domains. Require every source
    // until individual tools declare and enforce a narrower source contract.
    return [
      'ai',
      'patients',
      'appointments',
      'clinical',
      'billing',
      'finance',
      'inventory',
      'lab',
      'crm',
      'staff',
      'reports',
    ]
  }
  if (is('/settings/forms') || is('/clinical-forms') || is('/forms')) return ['forms']
  if (
    is('/settings/procedures') ||
    is('/procedures') ||
    is('/medications') ||
    is('/treatments') ||
    is('/treatment-plans') ||
    is('/prescriptions') ||
    is('/dental-chart') ||
    /\/patients\/[^/]+\/(dental-chart|prescriptions|clinical-chart|images)/.test(path)
  )
    return ['clinical']
  if (
    is('/settings/billing') ||
    is('/billing') ||
    is('/invoices') ||
    is('/payments') ||
    is('/payment-plans')
  )
    return ['billing']
  if (is('/lab') || is('/lab-orders') || is('/lab-vendors')) return ['lab']
  if (is('/settings/import') || is('/data-import')) return ['data_import']
  if (is('/settings/communications') || is('/communications')) return ['communications']
  if (is('/crm') || is('/memberships') || is('/loyalty') || is('/referrals')) return ['crm']
  for (const key of [
    'patients',
    'appointments',
    'finance',
    'inventory',
    'staff',
    'reports',
    'sterilization',
    'devices',
    'video',
  ] as ModuleId[]) {
    if (is(`/${key}`) || (key === 'staff' && is('/staff-invites'))) return [key]
  }
  if (is('/patient-portal') || is('/portal')) {
    const requirements: ModuleId[] = ['portal']
    if (/\/(appointments|slots|doctors|book)(\/|$)/.test(path)) requirements.push('appointments')
    if (/\/(records|prescriptions)(\/|$)/.test(path)) requirements.push('clinical')
    if (/\/bills(\/|$)/.test(path)) requirements.push('billing')
    if (/\/forms(\/|$)/.test(path)) requirements.push('forms')
    if (/\/video(\/|$)/.test(path)) requirements.push('video')
    return requirements
  }
  if (is('/public')) return ['appointments', 'portal']
  if (
    is('/dashboard') ||
    is('/doctor') ||
    is('/search') ||
    is('/audit-log') ||
    is('/settings') ||
    is('/auth') ||
    is('/license') ||
    is('/features') ||
    is('/onboarding') ||
    is('/notifications') ||
    is('/uploads') ||
    is('/integrations')
  )
    return ['core']
  if (is('/health') || is('/ready') || is('/tenant-branding') || is('/access') || is('/recovery'))
    return ['core']
  return null
}

export interface SaaSAccess {
  clientOptions?: Partial<Record<'recoveryRead' | 'backupExport' | 'licenseImport', boolean>>
  tenantId: string
  name: string
  slug: string
  hostname: string | null
  customerId: string
  mode: 'hosted' | 'offline'
  planName: string
  modules: ModuleId[]
  state: string
  status: string
  allowsWrite: boolean
  revision: number
  accessUntil: string | null
  graceUntil: string | null
  monthlyFee: string
  currency: string
  suspensionReason?: string | null
  scheduledModules?: ModuleId[] | null
  scheduledAt?: string | null
  branding: {
    displayName?: string
    nameAm?: string
    logo?: string
    primaryColor?: string
    contactEmail?: string
    contactPhone?: string
    address?: string
    renewalContact?: string
  }
}

export function accessDenial(access: SaaSAccess, pathname: string, method: string) {
  const required = modulesForPath(pathname)
  if (!required) return { status: 403, code: 'MODULE_ROUTE_UNREGISTERED' }
  if (required.some((key) => !access.modules.includes(key))) {
    return { status: 403, code: 'MODULE_NOT_ENABLED' }
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !access.allowsWrite) {
    return { status: 423, code: 'SUBSCRIPTION_WRITE_RESTRICTED' }
  }
  return null
}

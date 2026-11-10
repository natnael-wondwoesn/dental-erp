// Owner-console module catalogs for every product the control plane manages.
// The dental clinic app's own runtime gate lives in ./catalog.ts; this module is
// only for the vendor owner console, which renders and validates module grants
// for clinics across products. Keep each JSON in sync with its Python twin in
// backend/app/commercial_access.py (asserted by test_commercial_access.py).
import dentalCatalog from '@/config/saas-modules.json'
import physioCatalog from '@/config/saas-modules.physio.json'

export type ProductKey = 'dental-erp' | 'clinic-cms'
export const DEFAULT_PRODUCT: ProductKey = 'dental-erp'

type Graph = Record<string, string[]>

const CATALOGS: Record<string, Graph> = {
  'dental-erp': dentalCatalog as Graph,
  'clinic-cms': physioCatalog as Graph,
}

export const PRODUCTS: { key: ProductKey; label: string; starter: string[] }[] = [
  {
    key: 'dental-erp',
    label: 'Dental ERP',
    starter: ['core', 'patients', 'appointments', 'clinical'],
  },
  {
    key: 'clinic-cms',
    label: 'Physiotherapy (Union Physio)',
    starter: ['core', 'patients', 'appointments', 'assessments', 'treatment_plans'],
  },
]

export function productLabel(product: string | undefined): string {
  return (
    PRODUCTS.find((entry) => entry.key === (product ?? DEFAULT_PRODUCT))?.label ?? String(product)
  )
}

export function catalogFor(product: string | undefined): Graph {
  return CATALOGS[product ?? DEFAULT_PRODUCT] ?? CATALOGS[DEFAULT_PRODUCT]
}

export function moduleIdsFor(product: string | undefined): string[] {
  return Object.keys(catalogFor(product))
}

export function starterFor(product: string | undefined): string[] {
  return (
    PRODUCTS.find((entry) => entry.key === (product ?? DEFAULT_PRODUCT))?.starter ??
    PRODUCTS[0].starter
  )
}

export function presetsFor(product: string | undefined): [string, string[]][] {
  const all = moduleIdsFor(product)
  const starter = starterFor(product)
  if ((product ?? DEFAULT_PRODUCT) === 'dental-erp') {
    return [
      ['Starter', starter],
      ['Practice', [...starter, 'billing']],
      ['All modules', all],
    ]
  }
  return [
    ['Starter', starter],
    ['All modules', all],
  ]
}

/** Mirror of the backend validate_modules; never auto-enables a paid dependency. */
export function validateModulesFor(product: string | undefined, grants: string[]): string[] {
  const catalog = catalogFor(product)
  const selected = new Set(grants)
  if (!selected.has('core')) throw new Error('Core module is required')
  for (const grant of grants) {
    if (!Object.hasOwn(catalog, grant)) throw new Error(`Unknown module: ${grant}`)
    for (const dependency of catalog[grant]) {
      if (!selected.has(dependency)) throw new Error(`${grant} requires ${dependency}`)
    }
  }
  return [...selected].sort()
}

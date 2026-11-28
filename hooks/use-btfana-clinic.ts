'use client'

import { useEffect, useState } from 'react'
import { isBtfanaClinicName } from '@/lib/clinic-flags'

/** null while loading, then true/false. Pages render their normal UI unless this is true. */
export function useBtfanaClinic(): boolean | null {
  const [value, setValue] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/tenant-branding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((p) => active && setValue(isBtfanaClinicName(p?.name)))
      .catch(() => active && setValue(false))
    return () => {
      active = false
    }
  }, [])
  return value
}

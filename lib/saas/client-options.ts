import type { SaaSAccess } from './catalog'

export const clientOptionLabels = {
  recoveryRead: 'Read-only record recovery',
  backupExport: 'Clinic backup download',
  licenseImport: 'Import provider-issued license',
} as const
export type ClientOption = keyof typeof clientOptionLabels

export function hasClientOption(access: SaaSAccess | undefined, option: ClientOption): boolean {
  return access?.clientOptions?.[option] === true
}

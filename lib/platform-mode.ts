const TRUE_VALUES = new Set(['1', 'true', 'yes'])

export function isPlatformControlPlane(): boolean {
  return TRUE_VALUES.has((process.env.PLATFORM_CONTROL_PLANE_MODE || '').trim().toLowerCase())
}

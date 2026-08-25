import { getLicenseRuntime, licenseEnforcement, type LicenseRuntime } from './license-runtime'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function evaluateApiLicenseGate(
  requestMethod: string | null,
  runtime: LicenseRuntime = getLicenseRuntime()
) {
  const enforcement = licenseEnforcement()
  if (enforcement === 'disabled' || (requestMethod && SAFE_METHODS.has(requestMethod))) return null
  const decision = await runtime.decide()
  if (enforcement !== 'required' || decision.allows_write) return null
  return decision
}

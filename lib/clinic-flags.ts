/** btFana-only features are enabled by clinic name so every other clinic is unaffected. */
export function isBtfanaClinicName(name: string | null | undefined): boolean {
  return /btfana/i.test(name ?? '')
}

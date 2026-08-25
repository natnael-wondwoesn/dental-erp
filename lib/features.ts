export const PRODUCT_FEATURES = ['handwrittenDiagnosis'] as const

export type ProductFeature = (typeof PRODUCT_FEATURES)[number]

const ENV_BY_FEATURE: Record<ProductFeature, string> = {
  handwrittenDiagnosis: 'FEATURE_HANDWRITTEN_DIAGNOSIS',
}

function enabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

export function isFeatureEnabled(feature: ProductFeature): boolean {
  return enabled(process.env[ENV_BY_FEATURE[feature]])
}

export function getPublicFeatureEntitlements(): Record<ProductFeature, boolean> {
  return Object.fromEntries(
    PRODUCT_FEATURES.map((feature) => [feature, isFeatureEnabled(feature)])
  ) as Record<ProductFeature, boolean>
}

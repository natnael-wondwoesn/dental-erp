import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LanguageProvider, useLanguage } from '@/lib/i18n'
import { ModularDashboard, TenantAccessProvider } from '@/components/saas/tenant-access'
import type { SaaSAccess } from '@/lib/saas/catalog'
function Switch() {
  const { setLocale } = useLanguage()
  return <button onClick={() => setLocale('am')}>Amharic</button>
}
it('translates the actual SaaS dashboard, evaluation status and Forms module', () => {
  const initial = {
    name: 'Test Clinic',
    planName: '30-day evaluation',
    state: 'trial',
    modules: ['core', 'patients', 'forms', 'portal', 'video', 'ai'],
    branding: {},
  } as SaaSAccess
  render(
    <LanguageProvider>
      <TenantAccessProvider initial={initial}>
        <Switch />
        <ModularDashboard />
      </TenantAccessProvider>
    </LanguageProvider>
  )
  fireEvent.click(screen.getByText('Amharic'))
  expect(screen.queryByText('Your clinic workspace')).not.toBeInTheDocument()
  expect(screen.getByText('የክሊኒክዎ የስራ ቦታ')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'ቅጾች' })).toBeInTheDocument()
  expect(screen.queryByText(/30-day evaluation/)).not.toBeInTheDocument()
})

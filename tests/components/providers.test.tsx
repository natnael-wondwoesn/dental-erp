import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const themeProviderSpy = vi.fn()

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    themeProviderSpy(props)
    return <>{children}</>
  },
}))

vi.mock('@/lib/api-client', () => ({
  installAuthenticatedFetch: vi.fn(),
}))

vi.mock('@/lib/i18n', () => ({
  LanguageProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

import { Providers } from '@/components/providers'

describe('Providers theme configuration', () => {
  beforeEach(() => themeProviderSpy.mockClear())

  it('keeps the light-only dashboard from inheriting the operating-system dark theme', () => {
    render(
      <Providers>
        <div>Application</div>
      </Providers>
    )

    expect(screen.getByText('Application')).toBeInTheDocument()
    expect(themeProviderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'light',
        forcedTheme: 'light',
        enableSystem: false,
      })
    )
  })
})

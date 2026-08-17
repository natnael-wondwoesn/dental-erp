import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import type { SiteConfig } from '@/lib/site-config'
import type { ProductTier } from '@/lib/product-tier'

const config = {
  clinic: {
    name: { en: 'Dentix Dental Clinic', am: 'ዴንቲክስ የጥርስ ክሊኒክ' },
    tagline: { en: 'Strong teeth, bright smile.', am: 'ጠንካራ ጥርሶች፣ ብሩህ ፈገግታ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: { phones: ['+251911234567'], email: 'hello@dentix.et' },
  hours: [{ day: { en: 'Monday', am: 'ሰኞ' }, open: '08:30', close: '18:00' }],
  services: [{ title: { en: 'Cleaning', am: 'ጽዳት' }, copy: { en: 'Gentle.', am: 'ገር።' } }],
  doctors: [],
  about: { story: { en: 'Story.', am: 'ታሪክ።' }, metrics: [] },
} as SiteConfig

function renderChrome(tier: ProductTier, node: React.ReactNode) {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier={tier}>
        {node}
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('SiteHeader', () => {
  it('shows the clinic name from config, not a hardcoded brand', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.getByText('Dentix Dental Clinic')).toBeInTheDocument()
  })

  it('offers the workspace link in full tier', () => {
    renderChrome('full', <SiteHeader />)
    expect(screen.getByRole('link', { name: /open workspace/i })).toHaveAttribute('href', '/login')
  })

  it('hides the workspace link in landing tier', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.queryByRole('link', { name: /open workspace/i })).not.toBeInTheDocument()
  })

  it('links to the standalone about and contact pages', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.getByRole('link', { name: /about us/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })

  it('marks the active link distinctly from inactive links', () => {
    renderChrome('landing', <SiteHeader />)
    const homeLink = screen.getAllByRole('link', { name: /home/i })[0]
    const aboutLink = screen.getAllByRole('link', { name: /about us/i })[0]
    expect(homeLink.getAttribute('class')).toContain('font-semibold')
    expect(aboutLink.getAttribute('class')).not.toContain('font-semibold')
  })

  it('gives the mobile menu panel z-20 when open', () => {
    renderChrome('landing', <SiteHeader />)
    fireEvent.click(screen.getByLabelText('Toggle navigation'))
    const links = screen.getAllByRole('link', { name: /home/i })
    const mobilePanel = links[links.length - 1].closest('div.md\\:hidden')
    expect(mobilePanel).not.toBeNull()
    expect(mobilePanel?.getAttribute('class')).toContain('z-20')
  })
})

describe('SiteFooter', () => {
  it('hides the workspace link in landing tier', () => {
    renderChrome('landing', <SiteFooter />)
    expect(screen.queryByRole('link', { name: /workspace/i })).not.toBeInTheDocument()
  })

  it('shows the workspace link in full tier', () => {
    renderChrome('full', <SiteFooter />)
    expect(screen.getByRole('link', { name: /workspace/i })).toBeInTheDocument()
  })
})

describe('useSite', () => {
  it('throws outside a SiteProvider so a missing provider fails loudly', () => {
    // Must still be inside LanguageProvider: SiteHeader calls useLanguage()
    // before useSite(), so without it we would assert on the wrong error.
    expect(() =>
      render(
        <LanguageProvider>
          <SiteHeader />
        </LanguageProvider>
      )
    ).toThrow(/SiteProvider/)
  })
})

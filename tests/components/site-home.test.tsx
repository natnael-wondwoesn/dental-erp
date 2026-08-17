import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import {
  AboutSection,
  DoctorsSection,
  HeroSection,
  ServicesSection,
} from '@/components/site/home-sections'
import type { SiteConfig } from '@/lib/site-config'

const config = {
  clinic: {
    name: { en: 'Bright Smile', am: 'ብራይት ስማይል' },
    tagline: { en: 'Care you can feel.', am: 'የሚሰማዎት እንክብካቤ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: { phones: ['+251911234567'], email: 'hello@brightsmile.et' },
  hours: [{ day: { en: 'Monday', am: 'ሰኞ' }, open: '08:30', close: '18:00' }],
  services: [
    { title: { en: 'Implants', am: 'ተከላ' }, copy: { en: 'Titanium roots.', am: 'የቲታኒየም ሥር።' } },
    { title: { en: 'Whitening', am: 'ማንጻት' }, copy: { en: 'Brighter enamel.', am: 'ብሩህ ኢናሜል።' } },
  ],
  doctors: [
    {
      name: 'Dr Selam Abebe',
      credentials: { en: 'DDS', am: 'DDS' },
      bio: { en: 'Ten years of care.', am: 'አስር ዓመት እንክብካቤ።' },
    },
  ],
  about: {
    story: { en: 'Founded in Bole.', am: 'በቦሌ ተመሠረተ።' },
    metrics: [{ value: '20K+', label: { en: 'Happy patients', am: 'ደስተኛ ታካሚዎች' } }],
  },
} as SiteConfig

function renderSection(node: React.ReactNode) {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier="landing">
        {node}
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('HeroSection', () => {
  it('renders the clinic tagline from config', () => {
    renderSection(<HeroSection />)
    expect(screen.getByText('Care you can feel.')).toBeInTheDocument()
  })
})

describe('ServicesSection', () => {
  it('renders one card per configured service', () => {
    renderSection(<ServicesSection />)
    expect(screen.getByText('Implants')).toBeInTheDocument()
    expect(screen.getByText('Whitening')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
})

describe('AboutSection', () => {
  it('renders the story and every metric', () => {
    renderSection(<AboutSection />)
    expect(screen.getByText('Founded in Bole.')).toBeInTheDocument()
    expect(screen.getByText('20K+')).toBeInTheDocument()
    expect(screen.getByText('Happy patients')).toBeInTheDocument()
  })
})

describe('DoctorsSection', () => {
  it('renders each configured doctor with credentials', () => {
    renderSection(<DoctorsSection />)
    expect(screen.getByText('Dr Selam Abebe')).toBeInTheDocument()
    expect(screen.getByText('DDS')).toBeInTheDocument()
  })

  it('renders nothing when no doctors are configured', () => {
    const { container } = render(
      <LanguageProvider>
        <SiteProvider config={{ ...config, doctors: [] }} tier="landing">
          <DoctorsSection />
        </SiteProvider>
      </LanguageProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })
})

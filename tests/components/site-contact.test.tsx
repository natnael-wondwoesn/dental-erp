import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import { ContactDetails } from '@/components/site/contact-details'
import type { SiteConfig } from '@/lib/site-config'

const config = {
  clinic: {
    name: { en: 'Bright Smile', am: 'ብራይት ስማይል' },
    tagline: { en: 'Care.', am: 'እንክብካቤ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    landmark: 'Opposite Edna Mall',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: {
    phones: ['+251911234567', '+251911234568'],
    telegram: 'https://t.me/brightsmile',
    whatsapp: '+251911234567',
    email: 'hello@brightsmile.et',
  },
  hours: [
    { day: { en: 'Monday – Friday', am: 'ሰኞ – ዓርብ' }, open: '08:30', close: '18:00' },
    { day: { en: 'Sunday', am: 'እሁድ' }, open: '00:00', close: '00:00' },
  ],
  services: [],
  doctors: [],
  about: { story: { en: 'Story.', am: 'ታሪክ።' }, metrics: [] },
} as unknown as SiteConfig

function renderContact(tier: 'landing' | 'full' = 'landing') {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier={tier}>
        <ContactDetails />
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('ContactDetails', () => {
  it('renders every phone number as a tel: link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: '+251911234567' })).toHaveAttribute(
      'href',
      'tel:+251911234567'
    )
    expect(screen.getByRole('link', { name: '+251911234568' })).toHaveAttribute(
      'href',
      'tel:+251911234568'
    )
  })

  it('renders the email as a mailto: link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: 'hello@brightsmile.et' })).toHaveAttribute(
      'href',
      'mailto:hello@brightsmile.et'
    )
  })

  it('renders the Telegram link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: /telegram/i })).toHaveAttribute(
      'href',
      'https://t.me/brightsmile'
    )
  })

  it('builds a wa.me link from the WhatsApp number without the plus sign', () => {
    renderContact()
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/251911234567'
    )
  })

  it('renders the full Ethiopian address including sub-city and woreda', () => {
    renderContact()
    expect(screen.getByText(/Bole/)).toBeInTheDocument()
    expect(screen.getByText(/Woreda 03/)).toBeInTheDocument()
    expect(screen.getByText(/Opposite Edna Mall/)).toBeInTheDocument()
  })

  it('embeds the map', () => {
    renderContact()
    expect(screen.getByTitle(/map/i)).toHaveAttribute(
      'src',
      'https://www.google.com/maps/embed?pb=test'
    )
  })

  it('renders opening hours, showing Closed for a 00:00–00:00 day', () => {
    renderContact()
    expect(screen.getByText('Monday – Friday')).toBeInTheDocument()
    expect(screen.getByText('08:30 – 18:00')).toBeInTheDocument()
    expect(screen.getByText(/closed/i)).toBeInTheDocument()
  })

  it('does not offer online booking in landing tier', () => {
    renderContact('landing')
    expect(screen.queryByRole('link', { name: /book online/i })).not.toBeInTheDocument()
  })

  it('offers online booking through the patient portal in full tier', () => {
    renderContact('full')
    expect(screen.getByRole('link', { name: /book online/i })).toHaveAttribute(
      'href',
      '/portal/book'
    )
  })
})

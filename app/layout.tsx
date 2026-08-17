import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: {
    default: 'Dentix — Ethiopian Dental Clinic ERP',
    template: '%s | Dentix',
  },
  description:
    'Production dental clinic operations for Ethiopia: patient care, scheduling, treatment, ETB billing, laboratory workflows, finance and reporting.',
  keywords: [
    'dental software India',
    'dental clinic management software',
    'dental hospital management system',
    'dental ERP',
    'dental practice management',
    'open source dental software',
    'free dental software India',
    'dental billing software GST',
    'patient management system dental',
    'appointment scheduling dental',
    'dental clinic software free',
    'hospital management system India',
    'HMS India',
    'dental records software',
    'AI dental software',
    'tele-dentistry India',
    'dental inventory management',
    'dental insurance claims India',
    'dental lab management',
    'multi-branch dental software',
  ],
  authors: [{ name: 'Abinauv Selvaraj' }],
  creator: 'Abinauv Selvaraj',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_ET',
    title: 'Dentix — Ethiopian Dental Clinic ERP',
    description: 'A modern English and Amharic dental clinic operating system for Ethiopia.',
    siteName: 'DentalERP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DentalERP - Open Source Dental Hospital Management Software',
    description:
      'Free, AI-powered dental clinic management system for India. 16 AI skills, GST billing, patient portal, tele-dentistry.',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DentalERP',
  },
}

export const viewport: Viewport = {
  themeColor: '#0769E7',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}

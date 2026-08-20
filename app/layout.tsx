import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/noto-sans-ethiopic/wght.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: {
    default: 'Sunny Smile Speciality Clinic — Ethiopian Dental Care',
    template: '%s | Sunny Smile Speciality Clinic',
  },
  description:
    'Production dental clinic operations for Ethiopia: patient care, scheduling, treatment, ETB billing, laboratory workflows, finance and reporting.',
  keywords: [
    'ethiopian dental software',
    'ethiopia dental clinic management software',
    'ethiopian dental hospital management system',
    'dental ERP',
    'dental practice management',
    'open source dental software',
    'free dental software Ethiopia',
    'ETB dental billing software',
    'patient management system dental',
    'appointment scheduling dental',
    'dental clinic software free',
    'hospital management system Ethiopia',
    'Habesha clinic software',
    'dental records software',
    'AI dental software',
    'tele-dentistry Ethiopia',
    'dental inventory management',
    'dental insurance claims Ethiopia',
    'dental lab management',
    'multi-branch dental software',
  ],
  authors: [{ name: 'Abinauv Selvaraj' }],
  creator: 'Abinauv Selvaraj',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_ET',
    title: 'Sunny Smile Speciality Clinic — Ethiopian Dental Care',
    description: 'A modern English and Amharic dental clinic operating system for Ethiopia.',
    siteName: 'DentalERP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sunny Smile Speciality Clinic - Ethiopian Dental Care',
    description:
      'Dental clinic operations for Ethiopia with patient workflows, ETB billing, and multilingual communication.',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sunny Smile Speciality Clinic',
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

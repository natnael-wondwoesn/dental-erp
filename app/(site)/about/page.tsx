'use client'

import { SiteHeader } from '@/components/site/site-header'
import { AboutSection, DoctorsSection } from '@/components/site/home-sections'
import { useLanguage } from '@/lib/i18n'

export default function AboutPage() {
  const { t } = useLanguage()
  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#101622]">
      <section className="mx-auto max-w-[1480px] px-4 pb-20 pt-4 sm:px-7 lg:px-10">
        <div className="relative min-h-[220px] overflow-hidden rounded-[36px] bg-[#15304d]">
          <SiteHeader />
        </div>
      </section>
      <section className="px-5 pb-4 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-10 text-5xl font-medium tracking-[-.05em] sm:text-6xl">
            {t('About us')}
          </h1>
        </div>
      </section>
      <AboutSection />
      <DoctorsSection />
    </main>
  )
}

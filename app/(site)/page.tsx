'use client'

import { SiteHeader } from '@/components/site/site-header'
import {
  AboutSection,
  DoctorsSection,
  HeroSection,
  ServicesSection,
} from '@/components/site/home-sections'

export default function HomePage() {
  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#101622]">
      <section className="mx-auto max-w-[1480px] px-4 pb-20 pt-4 sm:px-7 lg:px-10">
        <div className="relative min-h-[760px] overflow-hidden rounded-[36px] bg-[#15304d] lg:min-h-[680px] xl:min-h-[700px]">
          <SiteHeader />
          <HeroSection />
        </div>
      </section>
      <AboutSection />
      <ServicesSection />
      <DoctorsSection />
    </main>
  )
}

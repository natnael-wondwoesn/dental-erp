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
    <main className="marketing-page min-h-screen overflow-hidden bg-[#eef4ff] text-[#10233f]">
      <section className="mx-auto max-w-[1520px] px-3 pb-16 pt-3 sm:px-6 sm:pt-5 lg:px-8">
        <div className="marketing-hero-shell relative min-h-[780px] overflow-hidden rounded-[32px] border border-white/80 bg-[#f8fbff] shadow-[0_36px_100px_-46px_rgba(22,61,103,.38)] sm:rounded-[42px] lg:min-h-[760px]">
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

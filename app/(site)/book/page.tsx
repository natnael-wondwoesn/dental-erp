import { SiteHeader } from '@/components/site/site-header'
import { PublicBookingForm, PublicBookingIntro } from '@/components/site/public-booking-form'

export const dynamic = 'force-dynamic'

export default function PublicBookingPage() {
  const clinicSlug = process.env.PUBLIC_BOOKING_CLINIC_SLUG || 'demo-dental-clinic'

  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#10233f]">
      <div className="relative min-h-screen overflow-hidden px-5 pb-20 pt-36 sm:px-8 sm:pt-40">
        <SiteHeader />
        <div className="marketing-ambient marketing-ambient-one" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
          <PublicBookingIntro />
          <PublicBookingForm clinicSlug={clinicSlug} />
        </div>
      </div>
    </main>
  )
}

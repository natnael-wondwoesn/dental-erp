'use client'

import Image from 'next/image'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

export function HeroSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <>
      <Image
        src="/assets/dentix-hero-ethiopia.png"
        alt="An Ethiopian patient receiving gentle dental care in a modern Addis Ababa clinic"
        fill
        priority
        className="object-cover object-center opacity-80"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/25" />

      <div
        id="home"
        className="absolute inset-x-0 bottom-0 z-10 grid gap-8 p-7 text-white sm:p-12 lg:grid-cols-[1.15fr_.85fr] lg:p-20"
      >
        <div>
          <div className="mb-5 flex items-center gap-3 text-sm">
            <span className="flex -space-x-2" aria-hidden="true">
              {['20%', '50%', '80%'].map((position) => (
                <span
                  key={position}
                  className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200"
                >
                  <Image
                    src="/assets/dentix-team-ethiopia.png"
                    alt=""
                    fill
                    className="object-cover"
                    style={{ objectPosition: `${position} center` }}
                    sizes="32px"
                  />
                </span>
              ))}
            </span>
            <span>{t('20K+ smiles cared for')}</span>
          </div>
          <h1 className="max-w-3xl text-6xl font-medium leading-[.92] tracking-[-.055em] sm:text-7xl lg:text-[76px] xl:text-[84px]">
            {localize(config.clinic.tagline)}
          </h1>
        </div>
        <div className="flex flex-col justify-end lg:items-start lg:pb-4">
          <p className="max-w-md text-base leading-7 text-white/90 sm:text-lg">
            {t('Modern dentistry designed around comfort, clarity, and long-term confidence.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#services"
              className="rounded-full bg-[#0877ea] px-7 py-4 text-sm font-semibold transition hover:bg-[#0663c5]"
            >
              {t('Book appointment')}
            </a>
            <a
              href="#services"
              className="rounded-full bg-white px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {t('Browse services')}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export function AboutSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <section id="about" className="bg-white px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-6xl text-center">
        <p className="mb-7 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
          {t('About')} {localize(config.clinic.name)}
        </p>
        <h2 className="mx-auto max-w-5xl text-4xl font-medium leading-tight tracking-[-.04em] sm:text-6xl">
          {localize(config.about.story)}
        </h2>
        <a
          href="#services"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-7 py-4 text-sm font-semibold text-white"
        >
          {t('More about us')} <ArrowRight className="h-4 w-4" />
        </a>
        <div className="mt-24 grid grid-cols-2 gap-10 text-left lg:grid-cols-4">
          {config.about.metrics.map((metric) => (
            <div key={metric.value + localize(metric.label)}>
              <p className="text-5xl font-medium tracking-[-.05em] sm:text-6xl">{metric.value}</p>
              <p className="mt-3 text-sm text-slate-500">{localize(metric.label)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ServicesSection() {
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <section id="services" className="px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
              Our services
            </p>
            <h2 className="text-5xl font-medium tracking-[-.05em] sm:text-6xl">
              Care for every <span className="font-serif italic">smile.</span>
            </h2>
          </div>
          <p className="max-w-md text-slate-600">
            From everyday prevention to advanced restorative care, every visit is calm, clear, and
            personal.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {config.services.map((service, index) => (
            <article
              key={localize(service.title)}
              className="group rounded-[28px] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="mb-16 flex items-start justify-between">
                <Sparkles className="h-7 w-7 text-[#0877ea]" />
                <span className="text-sm text-slate-400">0{index + 1}</span>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{localize(service.title)}</h3>
              <p className="mt-3 leading-7 text-slate-500">{localize(service.copy)}</p>
              <button className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0877ea]">
                View details <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function DoctorsSection() {
  const { config } = useSite()
  const localize = useLocalize()

  if (config.doctors.length === 0) return null

  return (
    <section id="doctors" className="bg-white px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
            Our team
          </p>
          <h2 className="text-5xl font-medium leading-[.95] tracking-[-.05em] sm:text-6xl">
            Meet your expert <span className="block font-serif italic">dental team.</span>
          </h2>
          <p className="mt-7 max-w-md leading-7 text-slate-600">
            Specialists who listen carefully, explain every option, and make exceptional care feel
            reassuring.
          </p>
          <ul className="mt-8 space-y-3 text-sm font-medium">
            {[
              'Clear treatment plans',
              'Modern clinical technology',
              'Warm, unrushed appointments',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-[#0877ea]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {config.doctors.map((doctor) => (
            <div
              key={doctor.name}
              className="relative overflow-hidden rounded-[32px] bg-[#e8eef7] p-7"
            >
              {doctor.photo && (
                <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[20px]">
                  <Image
                    src={doctor.photo}
                    alt={doctor.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 30vw, 100vw"
                  />
                </div>
              )}
              <h3 className="text-xl font-semibold tracking-tight">{doctor.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#0877ea]">
                {localize(doctor.credentials)}
              </p>
              <p className="mt-3 leading-7 text-slate-600">{localize(doctor.bio)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

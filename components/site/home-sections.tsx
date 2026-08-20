'use client'

import Image from 'next/image'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, CalendarDays, Check, ShieldCheck, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (!('IntersectionObserver' in window)) {
      node.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        node.classList.add('is-visible')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`marketing-reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function HeroSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <div
      id="home"
      className="relative z-10 grid min-h-[780px] gap-10 px-6 pb-10 pt-32 sm:px-10 sm:pt-36 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:px-16 lg:pb-14 lg:pt-32 xl:px-20"
    >
      <div className="marketing-ambient marketing-ambient-one" aria-hidden="true" />
      <div className="marketing-ambient marketing-ambient-two" aria-hidden="true" />

      <div className="relative z-10 max-w-2xl">
        <div className="marketing-hero-enter marketing-hero-enter-1 mb-7 inline-flex items-center gap-2 rounded-full border border-[#0877ea]/15 bg-white/80 px-4 py-2 text-sm font-semibold text-[#24547e] shadow-[0_12px_35px_-20px_rgba(8,119,234,.75)] backdrop-blur-xl">
          <ShieldCheck className="h-4 w-4 text-[#0877ea]" />
          {t('Trusted dental care in Addis Ababa')}
        </div>
        <h1 className="marketing-hero-enter marketing-hero-enter-2 max-w-3xl text-[clamp(3.35rem,6.4vw,6.2rem)] font-medium leading-[.91] tracking-[-.065em] text-[#10233f]">
          {localize(config.clinic.tagline)}
        </h1>
        <p className="marketing-hero-enter marketing-hero-enter-3 mt-7 max-w-xl text-base leading-7 text-[#52667d] sm:text-lg sm:leading-8">
          {t('Modern dentistry designed around comfort, clarity, and long-term confidence.')}
        </p>
        <div className="marketing-hero-enter marketing-hero-enter-4 mt-8 flex flex-wrap gap-3">
          <a
            href="#services"
            className="marketing-button-primary inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-7 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(8,119,234,.9)]"
          >
            <CalendarDays className="h-4 w-4" />
            {t('Book appointment')}
          </a>
          <a
            href="#services"
            className="inline-flex items-center gap-2 rounded-full border border-[#b9cbe0] bg-white/75 px-7 py-4 text-sm font-semibold text-[#10233f] backdrop-blur-md transition hover:border-[#0877ea]/40 hover:bg-white"
          >
            {t('Browse services')} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="marketing-hero-enter marketing-hero-enter-5 mt-10 flex items-center gap-3 text-sm font-medium text-[#52667d]">
          <span className="flex -space-x-2" aria-hidden="true">
            {['20%', '50%', '80%'].map((position) => (
              <span
                key={position}
                className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm"
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
      </div>

      <div className="marketing-hero-visual marketing-hero-enter marketing-hero-enter-3 relative z-10 mx-auto w-full max-w-[680px] lg:ml-auto">
        <div
          className="absolute -inset-4 rounded-[44px] bg-gradient-to-br from-[#87c8ff]/35 via-white/20 to-[#55b8a6]/20 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative aspect-[4/4.35] overflow-hidden rounded-[32px] border-[7px] border-white bg-[#dceafa] shadow-[0_42px_90px_-38px_rgba(11,45,83,.62)] sm:rounded-[42px]">
          <Image
            src="/assets/dentix-hero-ethiopia.png"
            alt="An Ethiopian patient receiving gentle dental care in a modern Addis Ababa clinic"
            fill
            priority
            className="marketing-hero-image object-cover object-center"
            sizes="(min-width: 1024px) 50vw, 92vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c2845]/24 via-transparent to-white/5" />
        </div>
        <div className="marketing-float-card marketing-float-card-left absolute -left-3 bottom-[13%] max-w-[190px] rounded-2xl border border-white/80 bg-white/[.88] p-4 shadow-[0_24px_55px_-25px_rgba(10,41,76,.55)] backdrop-blur-xl sm:-left-8 sm:p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f3ff] text-[#0877ea]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[#10233f]">{t('Comfort-first care')}</p>
          <p className="mt-1 text-xs leading-5 text-[#6b7d90]">{t('Clear plans. Calm visits.')}</p>
        </div>
        <div className="marketing-float-card marketing-float-card-right absolute -right-2 top-[12%] rounded-2xl border border-white/80 bg-white/[.88] px-4 py-3 shadow-[0_22px_52px_-24px_rgba(10,41,76,.48)] backdrop-blur-xl sm:-right-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0877ea]">
            {config.location.city}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#10233f]">{t('Modern local dentistry')}</p>
        </div>
      </div>
    </div>
  )
}

export function AboutSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <section id="about" className="relative bg-white px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <Reveal className="relative">
          <div className="relative aspect-[4/4.5] overflow-hidden rounded-[34px] bg-[#e7eff8] shadow-[0_34px_80px_-42px_rgba(11,45,83,.55)] sm:rounded-[46px]">
            <Image
              src="/assets/dentix-team-ethiopia.png"
              alt="The Sunny Smile Speciality Clinic dental care team in Addis Ababa"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 42vw, 100vw"
            />
          </div>
          <div className="absolute -right-3 top-8 rounded-2xl border border-[#d8e7f5] bg-white/90 px-5 py-4 shadow-xl backdrop-blur-xl sm:-right-7">
            <p className="text-xl font-semibold tracking-tight text-[#0877ea]">
              {config.location.city}
            </p>
            <p className="mt-1 text-xs font-medium text-[#607287]">{t('Your local care team')}</p>
          </div>
        </Reveal>
        <div>
          <Reveal>
            <p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
              {t('About')} {localize(config.clinic.name)}
            </p>
            <h2 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-.045em] sm:text-6xl">
              {localize(config.about.story)}
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <a
              href="#services"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-7 py-4 text-sm font-semibold text-white shadow-[0_18px_36px_-18px_rgba(8,119,234,.8)]"
            >
              {t('More about us')} <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
          <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10">
            {config.about.metrics.map((metric) => (
              <Reveal key={metric.value + localize(metric.label)}>
                <div className="border-t border-[#dbe6f0] pt-5">
                  <p className="text-4xl font-medium tracking-[-.05em] sm:text-5xl">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{localize(metric.label)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ServicesSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  return (
    <section id="services" className="px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
              {t('Our services')}
            </p>
            <h2 className="text-5xl font-medium tracking-[-.05em] sm:text-6xl">
              {t('Care for every')} <span className="font-serif italic">{t('smile.')}</span>
            </h2>
          </div>
          <p className="max-w-md text-slate-600">
            {t(
              'From everyday prevention to advanced restorative care, every visit is calm, clear, and personal.'
            )}
          </p>
        </Reveal>
        <div className="grid gap-5 lg:grid-cols-3">
          {config.services.map((service, index) => (
            <Reveal
              key={localize(service.title)}
              delay={Math.min(index * 70, 280)}
              className="h-full"
            >
              <article className="marketing-service-card group h-full rounded-[28px] border border-white bg-white/90 p-7 shadow-[0_20px_50px_-38px_rgba(11,45,83,.5)] backdrop-blur-sm">
                <div className="mb-16 flex items-start justify-between">
                  <Sparkles className="h-7 w-7 text-[#0877ea]" />
                  <span className="text-sm text-slate-400">0{index + 1}</span>
                </div>
                <h3 className="text-2xl font-semibold tracking-tight">{localize(service.title)}</h3>
                <p className="mt-3 leading-7 text-slate-500">{localize(service.copy)}</p>
                <button className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0877ea]">
                  {t('View details')}{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function DoctorsSection() {
  const { t } = useLanguage()
  const { config } = useSite()
  const localize = useLocalize()

  if (config.doctors.length === 0) return null

  return (
    <section id="doctors" className="bg-white px-5 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <Reveal>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
            {t('Our team')}
          </p>
          <h2 className="text-5xl font-medium leading-[.95] tracking-[-.05em] sm:text-6xl">
            {t('Meet your expert')}{' '}
            <span className="block font-serif italic">{t('dental team.')}</span>
          </h2>
          <p className="mt-7 max-w-md leading-7 text-slate-600">
            {t(
              'Specialists who listen carefully, explain every option, and make exceptional care feel reassuring.'
            )}
          </p>
          <ul className="mt-8 space-y-3 text-sm font-medium">
            {[
              t('Clear treatment plans'),
              t('Modern clinical technology'),
              t('Warm, unrushed appointments'),
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-[#0877ea]" />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2">
          {config.doctors.map((doctor, index) => (
            <Reveal
              key={doctor.name}
              delay={index * 90}
              className={index % 2 ? 'sm:translate-y-10' : ''}
            >
              <div className="marketing-doctor-card relative overflow-hidden rounded-[32px] border border-[#dbe7f2] bg-[#edf4fb] p-7 shadow-[0_24px_60px_-45px_rgba(11,45,83,.65)]">
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
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

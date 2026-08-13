'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Menu, Sparkles, Stethoscope, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useLanguage } from '@/lib/i18n'

const services = [
  {
    title: 'Preventive Care',
    copy: 'Gentle check-ups, modern diagnostics, and a care plan designed around you.',
  },
  {
    title: 'Dental Implants',
    copy: 'Natural-looking, long-lasting restorations delivered with clinical precision.',
  },
  {
    title: 'Smile Design',
    copy: 'A personal approach to whitening, alignment, and confident smile transformations.',
  },
]

const metrics = [
  ['20K+', 'Happy patients'],
  ['300+', 'Dental partners'],
  ['14K+', 'Successful treatments'],
  ['98%', 'Patient satisfaction'],
]

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#101622]">
      <section className="mx-auto max-w-[1480px] px-4 pb-20 pt-4 sm:px-7 lg:px-10">
        <div className="relative min-h-[760px] overflow-hidden rounded-[36px] bg-[#15304d] lg:min-h-[680px] xl:min-h-[700px]">
          <Image
            src="/assets/dentix-hero-ethiopia.png"
            alt="An Ethiopian patient receiving gentle dental care in a modern Addis Ababa clinic"
            fill
            priority
            className="object-cover object-center opacity-80"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/25" />

          <header className="absolute left-1/2 top-5 z-20 flex w-[calc(100%-2rem)] max-w-[1260px] -translate-x-1/2 items-center justify-between rounded-full bg-white px-5 py-3 shadow-xl sm:top-8 sm:px-7">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0877ea] text-white">
                <Stethoscope className="h-4 w-4" />
              </span>
              <span className="text-lg">Dentix</span>
            </Link>
            <nav className="hidden items-center gap-9 text-sm text-slate-600 md:flex">
              <a className="font-semibold text-slate-950" href="#home">
                {t('Home')}
              </a>
              <a className="transition hover:text-[#0877ea]" href="#about">
                {t('About us')}
              </a>
              <a className="transition hover:text-[#0877ea]" href="#services">
                {t('Services')}
              </a>
              <a className="transition hover:text-[#0877ea]" href="#doctors">
                {t('Doctors')}
              </a>
              <Link className="transition hover:text-[#0877ea]" href="/pricing">
                {t('Pricing')}
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <Link
                href="/login"
                className="hidden rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0663c5] md:block"
              >
                {t('Open workspace')}
              </Link>
              <button
                className="md:hidden"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Toggle navigation"
              >
                {menuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </header>

          {menuOpen && (
            <div className="absolute left-6 right-6 top-24 z-20 rounded-3xl bg-white p-5 shadow-2xl md:hidden">
              <nav className="flex flex-col gap-4 text-sm font-medium">
                <a href="#about" onClick={() => setMenuOpen(false)}>
                  {t('About us')}
                </a>
                <a href="#services" onClick={() => setMenuOpen(false)}>
                  {t('Services')}
                </a>
                <a href="#doctors" onClick={() => setMenuOpen(false)}>
                  {t('Doctors')}
                </a>
                <Link
                  href="/login"
                  className="rounded-full bg-[#0877ea] px-5 py-3 text-center text-white"
                >
                  {t('Open workspace')}
                </Link>
              </nav>
            </div>
          )}

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
                {t('Strong teeth,')}
                <br />
                <span className="font-serif font-normal italic">{t('bright smile.')}</span>
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
        </div>
      </section>

      <section id="about" className="bg-white px-5 py-24 sm:px-10 lg:py-32">
        <div className="mx-auto max-w-6xl text-center">
          <p className="mb-7 text-sm font-semibold uppercase tracking-[.2em] text-[#0877ea]">
            {t('About Dentix')}
          </p>
          <h2 className="mx-auto max-w-5xl text-4xl font-medium leading-tight tracking-[-.04em] sm:text-6xl">
            {t(
              'High-quality dental care tailored to your needs, combining oral health with thoughtful aesthetics.'
            )}
          </h2>
          <a
            href="#services"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-7 py-4 text-sm font-semibold text-white"
          >
            {t('More about us')} <ArrowRight className="h-4 w-4" />
          </a>
          <div className="mt-24 grid grid-cols-2 gap-10 text-left lg:grid-cols-4">
            {metrics.map(([value, label]) => (
              <div key={label}>
                <p className="text-5xl font-medium tracking-[-.05em] sm:text-6xl">{value}</p>
                <p className="mt-3 text-sm text-slate-500">{t(label)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            {services.map((service, index) => (
              <article
                key={service.title}
                className="group rounded-[28px] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-16 flex items-start justify-between">
                  <Sparkles className="h-7 w-7 text-[#0877ea]" />
                  <span className="text-sm text-slate-400">0{index + 1}</span>
                </div>
                <h3 className="text-2xl font-semibold tracking-tight">{service.title}</h3>
                <p className="mt-3 leading-7 text-slate-500">{service.copy}</p>
                <button className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0877ea]">
                  View details <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

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
          <div className="relative aspect-[16/10] overflow-hidden rounded-[32px] bg-[#e8eef7]">
            <Image
              src="/assets/dentix-team-ethiopia.png"
              alt="The Ethiopian Dentix dental team in Addis Ababa"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
          </div>
        </div>
      </section>

      <footer className="bg-[#101d30] px-5 py-12 text-white sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xl font-semibold">Dentix</p>
            <p className="mt-1 text-sm text-white/60">Beautiful care. Brilliantly managed.</p>
          </div>
          <Link href="/login" className="rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold">
            Open clinic workspace
          </Link>
        </div>
      </footer>
    </main>
  )
}

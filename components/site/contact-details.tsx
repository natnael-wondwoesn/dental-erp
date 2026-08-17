'use client'

import { MessageCircle, Send } from 'lucide-react'

import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

export function ContactDetails() {
  const { t } = useLanguage()
  const { config, tier } = useSite()
  const localize = useLocalize()
  const { location, contact, hours } = config

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div className="rounded-[28px] bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t('Contact')}</h2>
          <ul className="mt-5 space-y-3 text-base">
            {contact.phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone}`} className="font-medium text-[#0877ea] hover:underline">
                  {phone}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="font-medium text-[#0877ea] hover:underline"
              >
                {contact.email}
              </a>
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            {contact.telegram && (
              <a
                href={contact.telegram}
                className="inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0663c5]"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t('Telegram')}
              </a>
            )}
            {contact.whatsapp && (
              <a
                href={`https://wa.me/${contact.whatsapp.replace('+', '')}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#0877ea] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0663c5]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t('WhatsApp')}
              </a>
            )}
            {tier === 'full' && (
              <a
                href="/portal/book"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0877ea] shadow-sm transition hover:bg-slate-50"
              >
                {t('Book online')}
              </a>
            )}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t('Find us')}</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {location.subCity}, Woreda {location.woreda}
            <br />
            {location.city}
            {location.kebele && (
              <>
                <br />
                {location.kebele}
              </>
            )}
            {location.landmark && (
              <>
                <br />
                {location.landmark}
              </>
            )}
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t('Opening hours')}</h2>
          <ul className="mt-4 space-y-2 text-base text-slate-600">
            {hours.map((entry) => (
              <li key={localize(entry.day)} className="flex items-center justify-between gap-6">
                <span>{localize(entry.day)}</span>
                <span className="font-medium text-slate-900">
                  {entry.open === '00:00' && entry.close === '00:00'
                    ? t('Closed')
                    : `${entry.open} – ${entry.close}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white p-2 shadow-sm">
        <iframe
          title="Clinic location map"
          src={location.mapEmbedUrl}
          loading="lazy"
          className="h-full min-h-[420px] w-full rounded-[22px] border-0"
        />
      </div>
    </div>
  )
}

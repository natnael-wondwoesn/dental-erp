'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Locale = 'en' | 'am'

const amharic: Record<string, string> = {
  Home: 'መነሻ',
  'About us': 'ስለ እኛ',
  Services: 'አገልግሎቶች',
  Doctors: 'ዶክተሮች',
  Pricing: 'ዋጋ',
  'Open workspace': 'የስራ ቦታ ይክፈቱ',
  'Book appointment': 'ቀጠሮ ይያዙ',
  'Browse services': 'አገልግሎቶችን ይመልከቱ',
  'Strong teeth,': 'ጠንካራ ጥርሶች፣',
  'bright smile.': 'ብሩህ ፈገግታ።',
  '20K+ smiles cared for': '20ሺ+ ፈገግታዎችን ተንከባክበናል',
  'Modern dentistry designed around comfort, clarity, and long-term confidence.':
    'ምቾትን፣ ግልጽነትን እና ዘላቂ እምነትን ያማከለ ዘመናዊ የጥርስ ሕክምና።',
  'About Dentix': 'ስለ ዴንቲክስ',
  'High-quality dental care tailored to your needs, combining oral health with thoughtful aesthetics.':
    'የአፍ ጤናን ከተመጣጠነ ውበት ጋር በማጣመር ለፍላጎትዎ የተስማማ ከፍተኛ ጥራት ያለው የጥርስ ሕክምና።',
  'More about us': 'ተጨማሪ ይወቁ',
  'Happy patients': 'ደስተኛ ታካሚዎች',
  'Dental partners': 'የጥርስ ሐኪሞች',
  'Successful treatments': 'የተሳኩ ሕክምናዎች',
  'Patient satisfaction': 'የታካሚ እርካታ',
  Patients: 'ታካሚዎች',
  Appointments: 'ቀጠሮዎች',
  Treatments: 'ሕክምናዎች',
  Prescriptions: 'ማዘዣዎች',
  Billing: 'ሂሳብ',
  Inventory: 'እቃ ክምችት',
  Reports: 'ሪፖርቶች',
  Settings: 'ቅንብሮች',
  Overview: 'አጠቃላይ እይታ',
  Dashboard: 'ዳሽቦርድ',
  'Patient Care': 'የታካሚ እንክብካቤ',
  Finance: 'ፋይናንስ',
  Operations: 'ኦፕሬሽኖች',
  Administration: 'አስተዳደር',
  'Patient list': 'የታካሚዎች ዝርዝር',
  'Edit patient': 'ታካሚን ያርትዑ',
  'Send message': 'መልዕክት ይላኩ',
  Gender: 'ጾታ',
  Birthday: 'የትውልድ ቀን',
  'Phone number': 'ስልክ ቁጥር',
  'Street address': 'አድራሻ',
  City: 'ከተማ',
  'ZIP code': 'ፖስታ ኮድ',
  'Member status': 'የአባልነት ሁኔታ',
  'Registered date': 'የተመዘገበበት ቀን',
  'Patient ID': 'የታካሚ መለያ',
  'Active member': 'ንቁ አባል',
  Past: 'ያለፉ',
  Upcoming: 'ቀጣይ',
  'Upcoming appointments': 'ቀጣይ ቀጠሮዎች',
  'Past appointments': 'ያለፉ ቀጠሮዎች',
  'Medical records': 'የሕክምና መዝገቦች',
  Notes: 'ማስታወሻዎች',
  'Save note': 'ማስታወሻ ያስቀምጡ',
  Saved: 'ተቀምጧል',
  'Files / documents': 'ፋይሎች / ሰነዶች',
  'Add files': 'ፋይሎች ያክሉ',
}

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (value: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en'
    const saved = window.localStorage.getItem('dental-erp-locale') as Locale | null
    return saved === 'am' ? 'am' : 'en'
  })

  useEffect(() => {
    window.localStorage.setItem('dental-erp-locale', locale)
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (text: string) => (locale === 'am' ? amharic[text] || text : text),
    }),
    [locale]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}

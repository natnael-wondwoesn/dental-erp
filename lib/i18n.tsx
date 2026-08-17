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
  'Financial Management': 'የፋይናንስ አስተዳደር',
  'Accounting & Finance': 'ሂሳብና ፋይናንስ',
  'Assessment & Treatment': 'ምርመራና ሕክምና',
  'Dental Laboratory': 'የጥርስ ላቦራቶሪ',
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
  'Clinic command centre': 'የክሊኒኩ የቁጥጥር ማዕከል',
  'Good morning. Your clinic is ready.': 'እንደምን አደሩ። ክሊኒኩ ለዛሬ ዝግጁ ነው።',
  'A focused view of today’s patients, care delivery and ETB cash position.':
    'የዛሬ ታካሚዎች፣ የሕክምና ሂደት እና የብር ገቢ ሁኔታ በአንድ እይታ።',
  'Register patient': 'ታካሚ ይመዝግቡ',
  'Today’s appointments': 'የዛሬ ቀጠሮዎች',
  waiting: 'በመጠበቅ ላይ',
  completed: 'ተጠናቋል',
  'Active patients': 'ንቁ ታካሚዎች',
  'registered this month': 'በዚህ ወር ተመዝግበዋል',
  'Revenue this month': 'የዚህ ወር ገቢ',
  'collected today': 'ዛሬ የተሰበሰበ',
  'Outstanding balance': 'ያልተከፈለ ቀሪ ሂሳብ',
  'active lab cases': 'ንቁ የላብራቶሪ ጉዳዮች',
  'Today’s flow': 'የዛሬ ሂደት',
  'View schedule': 'መርሐ ግብር ይመልከቱ',
  'No appointments remaining today': 'ለዛሬ የቀረ ቀጠሮ የለም',
  'The next booked visit will appear here.': 'ቀጣዩ የተያዘ ቀጠሮ እዚህ ይታያል።',
  'Cash position': 'የገንዘብ ሁኔታ',
  '7-day collections': 'የ7 ቀናት ገቢ',
  'Net cash flow': 'የተጣራ የገንዘብ ፍሰት',
  'Month expenses': 'የወሩ ወጪ',
  'Clinic workspaces': 'የክሊኒኩ የስራ ክፍሎች',
  'One patient-to-payment workflow': 'ከታካሚ እስከ ክፍያ የተገናኘ የስራ ሂደት',
  'Clinical care, laboratory work and finance stay connected to one patient record.':
    'ሕክምና፣ የላቦራቶሪ ስራ እና ፋይናንስ ከአንድ የታካሚ መዝገብ ጋር የተገናኙ ናቸው።',
  'Patient management': 'የታካሚ አስተዳደር',
  'Registration, profile, history and records': 'ምዝገባ፣ መገለጫ፣ ታሪክ እና መዝገቦች',
  'Booking, schedules, changes and history': 'ቀጠሮ መያዝ፣ መርሐ ግብር፣ ለውጥ እና ታሪክ',
  'Assessment & treatment': 'ምርመራና ሕክምና',
  'Charting, diagnosis, plans and follow-up': 'የጥርስ ቻርት፣ ምርመራ፣ ዕቅድ እና ክትትል',
  'Billing & payments': 'ሂሳብና ክፍያዎች',
  'Invoices, receipts, discounts and balances': 'ደረሰኞች፣ ክፍያዎች፣ ቅናሽ እና ቀሪ ሂሳብ',
  'Dental laboratory': 'የጥርስ ላቦራቶሪ',
  'Cases, appliances, status and lab cost': 'ትዕዛዞች፣ የጥርስ ስራዎች፣ ሁኔታ እና ወጪ',
  'Accounting & finance': 'ሂሳብና ፋይናንስ',
  'Income, expenses, commissions and cash flow': 'ገቢ፣ ወጪ፣ ኮሚሽን እና የገንዘብ ፍሰት',
  'Reports & performance': 'ሪፖርትና አፈጻጸም',
  'Clinical, revenue, dentist and clinic reporting': 'የሕክምና፣ ገቢ፣ ሐኪም እና ክሊኒክ ሪፖርት',
  'Addis Ababa time · ETB reporting · English / Amharic': 'የአዲስ አበባ ሰዓት · የብር ሪፖርት · እንግሊዝኛ / አማርኛ',
  Contact: 'አግኙን',
  'Contact us': 'አግኙን',
  'Opening hours': 'የስራ ሰዓታት',
  Closed: 'ዝግ',
  'Find us': 'የት እንደምንገኝ',
  'Book online': 'በመስመር ላይ ይያዙ',
  'Open clinic workspace': 'የክሊኒክ የስራ ቦታ ይክፈቱ',
  About: 'ስለ',
  Telegram: 'ቴሌግራም',
  WhatsApp: 'ዋትስአፕ',
}

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (value: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem('dental-erp-locale') as Locale | null
    // Hydrate with the server's English snapshot, then restore the preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'am') setLocale('am')
  }, [])

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

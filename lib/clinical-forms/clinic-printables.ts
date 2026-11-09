import { resolveClinicName } from '@/lib/branding'
import type { MedicalCertificateClinic } from './medical-certificate'

export const CLINIC_PRINTABLES = {
  consent: 'Patient Treatment Consent',
  'laboratory-order': 'Dental Laboratory Order',
  'cash-sales-attachment': 'Attachment Cash Sales Invoice',
  'berhanu-orthodontic-guidance': 'Orthodontic Patient Guidance',
  'berhanu-pre-treatment-notice': 'Before Dental Treatment Notice',
  'megenagna-treatment-consent': 'Megenagna Treatment Consent',
  'megenagna-medical-history': 'Megenagna Patient Medical History',
} as const

export type ClinicPrintableKey = keyof typeof CLINIC_PRINTABLES

export function isClinicPrintableKey(value: string): value is ClinicPrintableKey {
  return Object.hasOwn(CLINIC_PRINTABLES, value)
}

export function isClinicPrintableAllowedForClinic(
  key: ClinicPrintableKey,
  clinicName: string
): boolean {
  if (key.startsWith('berhanu-')) return /berhanu\s+belta/i.test(clinicName)
  if (key.startsWith('megenagna-')) return /megenagna/i.test(clinicName)
  return true
}

function e(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function line(label: string, className = '') {
  return `<div class="field ${className}"><span>${label}</span><b></b></div>`
}

function masthead(clinic: MedicalCertificateClinic, showName = true) {
  const phones = [clinic.phone, clinic.alternatePhone].filter(Boolean).join(' / ')
  return `<header class="masthead"><img src="/api/tenant-branding/logo" alt="" onerror="this.style.visibility='hidden'"><div>${showName && clinic.nameAm ? `<div class="am clinic-am">${e(clinic.nameAm)}</div>` : ''}${showName ? `<h1>${e(resolveClinicName(clinic.name))}</h1>` : ''}${phones ? `<p>Tel: ${e(phones)}</p>` : ''}</div></header>`
}

const baseCss = `
@page{size:A4;margin:9mm}*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#111;font:12px/1.35 Arial,sans-serif}.am{font-family:'Noto Sans Ethiopic',Arial,sans-serif}.toolbar{width:210mm;margin:12px auto 0;text-align:right}.toolbar button{border:0;border-radius:999px;background:#145da0;color:#fff;padding:10px 20px;font-weight:700;cursor:pointer}.paper{width:210mm;min-height:297mm;margin:12px auto;padding:10mm 12mm;background:#fff;box-shadow:0 16px 44px #10243e22}.masthead{display:grid;grid-template-columns:24mm 1fr;align-items:center;text-align:center;border-bottom:2px solid #111;padding-bottom:4mm}.masthead img{width:22mm;height:22mm;object-fit:contain}.masthead h1{margin:1mm 0;font-size:21px}.masthead p{margin:0;font-size:13px}.clinic-am{font-size:16px;font-weight:700}.title{text-align:center;margin:5mm 0;font-weight:800;font-size:18px;text-decoration:underline}.field{display:flex;align-items:end;gap:2mm;min-height:8mm}.field span{white-space:nowrap}.field b{flex:1;border-bottom:1px solid #111;min-height:5mm}.grid{display:grid;gap:2mm 5mm}.two{grid-template-columns:1fr 1fr}.three{grid-template-columns:1fr 1fr 1fr}.box{border:1px solid #111;padding:3mm}.signature-row{display:grid;grid-template-columns:1fr 1fr;gap:22mm;margin-top:10mm}.signature-row div{border-top:1px solid #111;padding-top:2mm;text-align:center}.muted{font-size:10px}.checks{display:flex;gap:8mm}.check:before{content:'□';font-size:18px;margin-right:2mm;vertical-align:-1px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:2mm;text-align:left;height:9mm}th{text-align:center;font-weight:700}@media print{body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}
body.consent .consent-points{margin:5mm 0 0;padding:0;list-style:none}body.consent .consent-points li{position:relative;padding-left:6mm;margin:4mm 0;font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:12px}body.consent .consent-points li:before{content:'*';position:absolute;left:0;font-weight:900}body.laboratory-order .paper{max-width:180mm}body.laboratory-order .box{break-inside:avoid}
body.cash-sales-attachment{font-family:'Times New Roman','Noto Sans Ethiopic',serif}body.cash-sales-attachment .paper{width:148mm;min-height:210mm;padding:5mm 6mm}body.cash-sales-attachment .receipt-head{text-align:center}body.cash-sales-attachment .receipt-head .am{font-size:12px;font-weight:700}body.cash-sales-attachment .receipt-head h1{font-size:13px;margin:0}body.cash-sales-attachment .receipt-head p{font-size:11px;margin:0}body.cash-sales-attachment .receipt-top{display:grid;grid-template-columns:1fr 1.2fr;gap:6mm;margin-top:3mm;font-size:9px}body.cash-sales-attachment .issuer{font-weight:700}body.cash-sales-attachment .issuer p{margin:1mm 0}body.cash-sales-attachment .receipt-fields .field{min-height:5mm}body.cash-sales-attachment .receipt-fields .field b{min-height:3mm}body.cash-sales-attachment .serial{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:11px}body.cash-sales-attachment .serial strong{font-size:17px;letter-spacing:2px}body.cash-sales-attachment .receipt-title{font-size:15px;margin:2mm 0 1mm}body.cash-sales-attachment table th,body.cash-sales-attachment table td{height:7mm;padding:1mm;font-size:8px}body.cash-sales-attachment table th{line-height:1.1}body.cash-sales-attachment .attachment-mark{position:absolute;left:22mm;top:104mm;z-index:2;transform:rotate(-12deg);font:900 30px/1 Arial,sans-serif;color:#555;opacity:.32;letter-spacing:1px}body.cash-sales-attachment .receipt-bottom{font-size:9px}body.cash-sales-attachment .receipt-bottom .signature-row{margin-top:5mm;gap:10mm}body.cash-sales-attachment .mrc{text-align:center;font-weight:700;font-size:10px;margin:4mm 0 0}body.cash-sales-attachment .invalid{text-align:center;font-weight:700;font-size:9px;margin:0}body.cash-sales-attachment .distribution{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:2mm;font-weight:700;text-align:center;margin-top:1mm}
body.berhanu-orthodontic-guidance .paper,body.berhanu-pre-treatment-notice .paper{padding:8mm 10mm}body .guide-title{background:#1f3a8a;color:#fff;text-align:center;font-weight:800;font-size:26px;line-height:1.4;padding:5mm 6mm;margin:7mm 0 8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}body .guide-list{list-style:none;margin:0;padding:0 4mm;font-family:'Noto Sans Ethiopic',Arial,sans-serif}body .guide-list li{position:relative;padding:0 0 0 12mm;margin:0 0 7mm;font-size:21px;font-weight:600;line-height:1.5;color:#1f2a6b;break-inside:avoid}body .guide-list li:before{content:'\\2713';position:absolute;left:0;top:-1px;color:#d62828;font-size:26px;font-weight:900}body.berhanu-orthodontic-guidance .guide-list li{font-size:18px;margin-bottom:6mm}body .guide-footer{margin:6mm 4mm 0;font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:21px;font-weight:800;color:#1f2a6b}
`

function consent(clinic: MedicalCertificateClinic) {
  return `${masthead(clinic)}<div class="title"><span class="am">የታካሚና የሐኪም የሕክምና ስምምነት</span><br><span style="font-size:13px">Patient Treatment Consent</span></div>
  ${line('<span class="am">የታካሚው ሙሉ ስም</span> / Patient full name')}
  ${line('<span class="am">የጥርስ ሕክምና ዓይነት</span> / Proposed dental treatment')}
  <div class="checks" style="justify-content:flex-end"><span class="check am">ተስማምቻለሁ / I agree</span><span class="check am">አልተስማማሁም / I decline</span></div>
  <ul class="consent-points"><li>ስለሚደረግልኝ የጥርስ ሕክምና፣ ጥቅሙ፣ ሊከሰቱ የሚችሉ አደጋዎችና አማራጮች በሐኪሙ በቂ ማብራሪያ ተሰጥቶኛል።</li><li>ከሕክምናው በፊት፣ በሕክምናው ጊዜ ወይም በኋላ ሊያጋጥሙ ስለሚችሉ ሁኔታዎች ጥያቄዎቼን ለመጠየቅ እድል አግኝቻለሁ።</li><li>ሕክምናው የሚፈለገውን ውጤት ሙሉ በሙሉ እንደሚያረጋግጥ ዋስትና እንደሌለ ተረድቻለሁ።</li><li>በራሴ ፈቃድ እና ያለ ግፊት የተገለጸው ሕክምና እንዲደረግልኝ እስማማለሁ።</li></ul>
  <div class="box muted" style="margin-top:5mm"><strong>English summary:</strong> The patient confirms that the proposed treatment, benefits, risks and alternatives were explained; questions were answered; no result was guaranteed; and consent is given voluntarily.</div>
  <div class="signature-row" style="margin-top:18mm"><div>የታካሚ / የአሳዳጊ ፊርማና ቀን<br>Patient / Guardian signature and date</div><div>የሐኪም ፊርማና ቀን<br>Treating dentist signature and date</div></div>`
}

function laboratoryOrder(clinic: MedicalCertificateClinic) {
  return `${masthead(clinic, false)}<div class="title">Dental Laboratory Work Order</div>
  <div class="grid two">${line('Case No.')}${line('Patient name')}${line("Dentist's name")}${line('Date received / sent')}${line('Delivery / expected return date')}</div>
  <div class="grid two" style="margin-top:4mm">${line('Prosthesis / appliance')}${line('Prosthesis material')}${line('Prosthesis type')}${line('Shade')}</div>
  <div class="box" style="margin-top:5mm"><strong>Teeth position / design</strong><div style="height:46mm;position:relative"><div style="position:absolute;left:20%;right:20%;top:50%;border-top:1px solid #111"></div><div style="position:absolute;top:20%;bottom:20%;left:50%;border-left:1px solid #111"></div></div></div>
  <div class="box" style="margin-top:5mm;height:48mm"><strong>Instructions to laboratory</strong></div>
  <p class="muted">Please provide complete case details and confirm the delivery date. Contact the clinic immediately if the expected date changes.</p>
  <div class="signature-row"><div>Ordered by / Dentist signature</div><div>Received by laboratory</div></div>`
}

function cashSales(clinic: MedicalCertificateClinic, attachmentNo: string) {
  const clinicName = resolveClinicName(clinic.name)
  const phones = [clinic.phone, clinic.alternatePhone].filter(Boolean).join(' / ')
  const isBerhanu = /berhanu\s+belta/i.test(clinicName)
  const tin = isBerhanu ? '0045234069' : clinic.registrationNo || ''
  const registration = isBerhanu ? '364/367ዑ103/10' : ''
  return `<header class="receipt-head">${clinic.nameAm ? `<div class="am">${e(clinic.nameAm)}</div>` : ''}<h1>${e(clinicName.replace('Dental Clinic', 'Clinic Service'))}</h1><p>☎ ${e(phones)}</p></header>
  <section class="receipt-top"><div class="issuer"><p class="am">ከ ${e(clinicName)}<br><span style="font-size:11px">From</span></p><p class="am">አድራሻ፡- ክ/ከ ወረዳ 09<br>የፈቃድ ቁ. <u>${e(registration)}</u></p><p>Address:- K/K &nbsp;&nbsp;&nbsp; W &nbsp;&nbsp;&nbsp; H.No</p><p class="am">የታክስ ከፋይ መ.ቁ <u>${e(tin)}</u><br><span style="font-size:11px">Tin No</span></p></div><div class="receipt-fields"><div class="serial"><span>Date ________</span><span>No <strong>${e(attachmentNo)}</strong></span></div>${line('F.S No.')}${line('Date')}${line('Time')}${line('Buyer’s Name')}${line('Buyer’s Trade Name')}${line('Buyer’s TIN. No')}${line('Buyer’s VAT Reg. No')}${line('Address: Zone/S.C___ Kebele___ H.No.___')}</div></section>
  <div class="title receipt-title">Attachment Cash Sales Invoice</div><div class="attachment-mark">ATTACHMENT</div>
  <table><thead><tr><th style="width:12mm"><span class="am">ኮድ</span><br>Code</th><th><span class="am">የእቃው/አገልግሎት ዝርዝር</span><br>Description</th><th style="width:12mm"><span class="am">መለኪያ</span><br>Unit</th><th style="width:10mm"><span class="am">ብዛት</span><br>Qty</th><th style="width:20mm"><span class="am">የአንዱ ዋጋ</span><br>Unit Price</th><th style="width:24mm"><span class="am">ጠቅላላ ዋጋ</span><br>Total Price</th></tr></thead><tbody>${Array.from({ length: 8 }, () => '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
  <section class="receipt-bottom"><div style="display:grid;grid-template-columns:1fr 36mm;gap:4mm;margin-top:1mm">${line('<span class="am">በፊደል</span><br>In Words')}<div class="field"><span><span class="am">ድምር</span><br>Total</span><b></b></div></div><div class="field"><span><span class="am">የክፍያው ሁኔታ</span> / Mode of Payment</span><b style="border:0"></b><span class="check">Cash</span><span class="check">Check</span><span>Check No.</span><b></b></div><div class="signature-row"><div><span class="am">ያዘጋጀው ሰው ፊርማ</span><br>Prepared by</div><div><span class="am">የገንዘብ ተቀባይ ፊርማ</span><br>Cashier’s Signature</div></div><p class="mrc">MRC CFF00006511</p><p class="invalid">Invalid without fiscal or refund receipt attachment</p><div class="distribution"><span>Dist:- &nbsp; Original - Customer</span><span>1st Copy Account</span><span>2nd Copy Pad</span></div></section>`
}

const BERHANU_GUIDES = {
  'berhanu-orthodontic-guidance': {
    title: 'ጥርስ ከተነቀለ በኋላ የሚደረጉ ጥንቃቄዎች',
    items: [
      'የተነከሱትን ጥጥ ለአንድ ሰዓት ነክሰው ይያዙ።',
      'የተነከሱትን ጥጥ ካወጡ በኋላ መድማት ካላቆመ ሀኪሙን ያማክሩ።',
      'ለ24 ሰዓት ትኩስ ነገር፣ ምግብ እና መጠጥ አይወሰድም።',
      'ለ24 ሰዓት ምራቅ መትፋት እና መጉመጥመጥ አይፈቀድም።',
      'አልኮል መጠጥ መውሰድ እና ሲጋራ ማጨስ አይፈቀድም።',
      'ከተነቀለ ከአንድ ቀን በኋላ ለብ ያለ 1 ሊትር ውሃ በ2 ማንኪያ ጨው ጨምረው መጉመጥመጥ።',
      'በሀኪም የታዘዘውን መድኃኒት በአግባቡ ይውሰዱ።',
    ],
    footer: '',
  },
  'berhanu-pre-treatment-notice': {
    title: 'ጥርስ ከማስነቀልዎ በፊት',
    items: [
      'የደም ግፊት ካለብዎ',
      'የስኳር ህመም ካለብዎ',
      'የሚጥል በሽታ ካለብዎ',
      'የአስም በሽታ ካለብዎ',
      'የልብ ድካም ካለብዎ',
      'እርግዝና ካለዎት',
      'ቁርስ ካልበሉ',
    ],
    footer: 'በቅድሚያ ለሀኪምዎ ያሳውቁ።',
  },
} as const

function berhanuPatientGuide(
  clinic: MedicalCertificateClinic,
  key: 'berhanu-orthodontic-guidance' | 'berhanu-pre-treatment-notice'
) {
  const guide = BERHANU_GUIDES[key]
  return `${masthead(clinic)}<div class="guide-title am">${guide.title}</div><ul class="guide-list">${guide.items.map((item) => `<li>${item}</li>`).join('')}</ul>${guide.footer ? `<p class="guide-footer">${guide.footer}</p>` : ''}`
}

const MEGENAGNA_CONDITIONS = [
  'ስኳር ህመም',
  'ደም ግፊት',
  'የልብ ችግር',
  'ቲቢ',
  'ደም ያለመርጋት ችግር',
  'የሚጥል በሽታ',
  'የጉበት ህመም',
  'የኤች አይ ቪ',
  'የነርቭ ችግር',
  'አስም',
  'የኩላሊት ህመም',
  'የመድሃኒት አለርጂ',
  'ደም ማነስ',
  'እርግዝና',
]

const MEGENAGNA_SERVICES = [
  'አክሬሊክ ጥርስ',
  'ወርቅ እና ነጭ ጥርስ',
  'ሴራሚክ',
  'ክሮምኮባልት',
  'ፓርሻል ዴንቸር',
  'ፉል ዴንቸር',
  'የጥርስ ሙሌት',
  'ጥርስ መንቀል (የጥርሱ አይነት)',
  'ጥርስ ስር ህክምና (የጥርሱ አይነት)',
  'የድድ ህክምና',
  'አርች ባር',
  'ኦርቶዶንቲክ ህክምና',
  'ጥርስ ማፅዳት',
  'ሪቴይነር',
]

function megenagnaTreatmentConsent(clinic: MedicalCertificateClinic) {
  return `${masthead(clinic)}<div class="field am" style="justify-content:flex-end;margin-top:3mm"><span>ቀን፦</span><b style="max-width:55mm"></b></div>
  <div class="title am">የጥርስ ህክምና ውል ስምምነት</div>
  <div class="grid" style="grid-template-columns:2fr 1fr 1fr 2fr">${line('የታካሚ ስም')}${line('ፆታ')}${line('ዕድሜ')}${line('አድራሻ')}</div>
  <div class="grid two">${line('ካርድ ቁ.')}${line('ስልክ ቁጥር')}</div>
  <div class="am megenagna-text"><p>እኔ ስሜ ከዚህ በታች የተጠቀሰው ታካሚ በዶ/ር</p>${line('', 'wide')}<p>እና በስራ ባልደረቦቹ የጥርስ ህክምና እንዲደረግልኝ ስል ተስማምቻለሁ።</p>${line('የበሽታው አይነት የጥርስ ህክምናው የሚደረግበት ምክንያት')}<p style="margin-top:5mm">እኔ ${'_'.repeat(34)} የተባልኩ ታካሚ የታመመውን ጥርሴን ለማስነቀል ወይም ማንኛውንም አይነት የጥርስ ህክምና ለማድረግ ማደንዘዣ ተሰጥቶኝ ህክምና እንዲደረግልኝ ስል በፊርማዬ አረጋግጣለሁ።</p>${line('ታካሚ ወይም ታካሚውን የሚወክል ስም')}</div>
  <div class="signature-row am"><div>የታካሚው ስምና ፊርማ</div><div>የሀኪሙ/ሚ ስምና ፊርማ</div></div>`
}

function megenagnaMedicalHistory(clinic: MedicalCertificateClinic) {
  const box = '<i class="mbox"></i>'
  return `${masthead(clinic)}<div class="grid two am" style="margin-top:3mm">${line('ቀን፦')}${line('ቁጥር፦')}</div>
  <div class="title am">በታካሚ የሚሞላ ስምምነት</div>
  <div class="grid" style="grid-template-columns:2fr 1fr 1fr">${line('ስም')}${line('ፆታ')}${line('ዕድሜ')}</div>
  <div class="mh-cols am"><section><p><b>በሀኪም የተረጋገጡ በሽታዎች</b></p><table class="mh-table"><thead><tr><th></th><th>ካለብዎት</th><th>ከሌለብዎት</th></tr></thead><tbody>${MEGENAGNA_CONDITIONS.map((c, i) => `<tr><td>${i + 1}. ${c}</td><td>${box}</td><td>${box}</td></tr>`).join('')}</tbody></table>
  <p style="margin-top:4mm"><b>ማሳሰቢያ</b></p><p>• ላለብዎ ህመም መድኃኒት</p><p><span class="check">ይወስዳሉ</span> &nbsp; <span class="check">አይወስዱም</span></p></section>
  <section><p><b>የተፈለገው አገልግሎት</b></p><ol class="mh-services">${MEGENAGNA_SERVICES.map((c) => `<li><span>${c}</span><b></b></li>`).join('')}</ol></section></div>
  <p class="am" style="margin-top:5mm">ከላይ በተጠቀሰው መሰረት የሰጠሁት ቃል ትክክል መሆኑን በፊርማዬ አረጋግጣለሁ።</p>
  <div class="grid two am">${line('ስም')}${line('ፊርማ')}</div>`
}

export function renderClinicPrintableHtml(
  key: ClinicPrintableKey,
  clinic: MedicalCertificateClinic,
  attachmentNo = '001'
) {
  const content =
    key === 'berhanu-orthodontic-guidance' || key === 'berhanu-pre-treatment-notice'
      ? berhanuPatientGuide(clinic, key)
      : key === 'megenagna-treatment-consent' || key === 'megenagna-medical-history'
        ? key === 'megenagna-treatment-consent'
          ? megenagnaTreatmentConsent(clinic)
          : megenagnaMedicalHistory(clinic)
        : key === 'consent'
          ? consent(clinic)
          : key === 'laboratory-order'
            ? laboratoryOrder(clinic)
            : cashSales(clinic, attachmentNo)
  const pageCss =
    key === 'cash-sales-attachment'
      ? '@page{size:A5 portrait;margin:5mm}'
      : key === 'megenagna-treatment-consent' || key === 'megenagna-medical-history'
        ? 'body .paper{padding:8mm 10mm}body .megenagna-text p{margin:3mm 0}body .megenagna-text .wide{min-height:8mm}body .mh-cols{display:grid;grid-template-columns:1.1fr 1fr;gap:8mm;margin-top:4mm}body .mh-table th,body .mh-table td{border:0;height:8.5mm;padding:1mm 2mm}body .mh-table td:first-child{text-align:left}body .mbox{display:block;width:12mm;height:6mm;border:1px solid #111;margin:0 auto}body .mh-services{list-style:none;margin:0;padding:0}body .mh-services li{display:flex;gap:2mm;align-items:end;min-height:10mm}body .mh-services li b{flex:1;border-bottom:1px solid #111;min-width:15mm}'
        : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(CLINIC_PRINTABLES[key])}</title><style>${baseCss}${pageCss}</style></head><body class="${e(key)}"><div class="toolbar"><button onclick="window.print()">Print form</button></div><main class="paper">${content}</main></body></html>`
}

import { resolveClinicName } from '@/lib/branding'
import type { MedicalCertificateClinic } from './medical-certificate'

export const CLINIC_PRINTABLES = {
  consent: 'Patient Treatment Consent',
  'laboratory-order': 'Dental Laboratory Order',
  'cash-sales-attachment': 'Attachment Cash Sales Invoice',
  'treatment-sheet': 'Patient Treatment Sheet',
} as const

export type ClinicPrintableKey = keyof typeof CLINIC_PRINTABLES

export function isClinicPrintableKey(value: string): value is ClinicPrintableKey {
  return Object.hasOwn(CLINIC_PRINTABLES, value)
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

function masthead(clinic: MedicalCertificateClinic) {
  const phones = [clinic.phone, clinic.alternatePhone].filter(Boolean).join(' / ')
  return `<header class="masthead"><img src="/api/tenant-branding/logo" alt="" onerror="this.style.display='none'"><div>${clinic.nameAm ? `<div class="am clinic-am">${e(clinic.nameAm)}</div>` : ''}<h1>${e(resolveClinicName(clinic.name))}</h1>${phones ? `<p>Tel: ${e(phones)}</p>` : ''}</div></header>`
}

const baseCss = `
@page{size:A4;margin:9mm}*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#111;font:12px/1.35 Arial,sans-serif}.am{font-family:'Noto Sans Ethiopic',Arial,sans-serif}.toolbar{width:210mm;margin:12px auto 0;text-align:right}.toolbar button{border:0;border-radius:999px;background:#145da0;color:#fff;padding:10px 20px;font-weight:700;cursor:pointer}.paper{width:210mm;min-height:297mm;margin:12px auto;padding:10mm 12mm;background:#fff;box-shadow:0 16px 44px #10243e22}.masthead{display:grid;grid-template-columns:24mm 1fr;align-items:center;text-align:center;border-bottom:2px solid #111;padding-bottom:4mm}.masthead img{width:22mm;height:22mm;object-fit:contain}.masthead h1{margin:1mm 0;font-size:21px}.masthead p{margin:0;font-size:13px}.clinic-am{font-size:16px;font-weight:700}.title{text-align:center;margin:5mm 0;font-weight:800;font-size:18px;text-decoration:underline}.field{display:flex;align-items:end;gap:2mm;min-height:8mm}.field span{white-space:nowrap}.field b{flex:1;border-bottom:1px solid #111;min-height:5mm}.grid{display:grid;gap:2mm 5mm}.two{grid-template-columns:1fr 1fr}.three{grid-template-columns:1fr 1fr 1fr}.box{border:1px solid #111;padding:3mm}.signature-row{display:grid;grid-template-columns:1fr 1fr;gap:22mm;margin-top:10mm}.signature-row div{border-top:1px solid #111;padding-top:2mm;text-align:center}.muted{font-size:10px}.checks{display:flex;gap:8mm}.check:before{content:'□';font-size:18px;margin-right:2mm;vertical-align:-1px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:2mm;text-align:left;height:9mm}th{text-align:center;font-weight:700}@media print{body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}
body.treatment-sheet .paper{background:#f7dce9}body.treatment-sheet table td{height:10mm}body.consent .consent-points{margin:5mm 0 0;padding:0;list-style:none}body.consent .consent-points li{position:relative;padding-left:6mm;margin:4mm 0;font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:12px}body.consent .consent-points li:before{content:'*';position:absolute;left:0;font-weight:900}body.laboratory-order .paper{max-width:180mm}body.laboratory-order .box{break-inside:avoid}
body.cash-sales-attachment{font-family:'Times New Roman','Noto Sans Ethiopic',serif}body.cash-sales-attachment .paper{width:148mm;min-height:210mm;padding:5mm 6mm}body.cash-sales-attachment .receipt-head{text-align:center}body.cash-sales-attachment .receipt-head .am{font-size:12px;font-weight:700}body.cash-sales-attachment .receipt-head h1{font-size:13px;margin:0}body.cash-sales-attachment .receipt-head p{font-size:11px;margin:0}body.cash-sales-attachment .receipt-top{display:grid;grid-template-columns:1fr 1.2fr;gap:6mm;margin-top:3mm;font-size:9px}body.cash-sales-attachment .issuer{font-weight:700}body.cash-sales-attachment .issuer p{margin:1mm 0}body.cash-sales-attachment .receipt-fields .field{min-height:5mm}body.cash-sales-attachment .receipt-fields .field b{min-height:3mm}body.cash-sales-attachment .serial{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:11px}body.cash-sales-attachment .serial strong{font-size:17px;letter-spacing:2px}body.cash-sales-attachment .receipt-title{font-size:15px;margin:2mm 0 1mm}body.cash-sales-attachment table th,body.cash-sales-attachment table td{height:7mm;padding:1mm;font-size:8px}body.cash-sales-attachment table th{line-height:1.1}body.cash-sales-attachment .attachment-mark{position:absolute;left:22mm;top:104mm;z-index:2;transform:rotate(-12deg);font:900 30px/1 Arial,sans-serif;color:#555;opacity:.32;letter-spacing:1px}body.cash-sales-attachment .receipt-bottom{font-size:9px}body.cash-sales-attachment .receipt-bottom .signature-row{margin-top:5mm;gap:10mm}body.cash-sales-attachment .mrc{text-align:center;font-weight:700;font-size:10px;margin:4mm 0 0}body.cash-sales-attachment .invalid{text-align:center;font-weight:700;font-size:9px;margin:0}body.cash-sales-attachment .distribution{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:2mm;font-weight:700;text-align:center;margin-top:1mm}
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
  return `${masthead(clinic)}<div class="title">Dental Laboratory Work Order</div>
  <div class="grid two">${line('Name of clinic')}${line('Case No.')}${line('Patient name')}${line("Dentist's name")}${line('Date received / sent')}${line('Delivery / expected return date')}</div>
  <div class="grid two" style="margin-top:4mm">${line('Prosthesis / appliance')}${line('Prosthesis material')}${line('Prosthesis type')}${line('Shade')}</div>
  <div class="box" style="margin-top:5mm"><strong>Teeth position / design</strong><div style="height:46mm;position:relative"><div style="position:absolute;left:20%;right:20%;top:50%;border-top:1px solid #111"></div><div style="position:absolute;top:20%;bottom:20%;left:50%;border-left:1px solid #111"></div></div></div>
  <div class="box" style="margin-top:5mm;height:48mm"><strong>Instructions to laboratory</strong></div>
  <p class="muted">Please provide complete case details and confirm the delivery date. Contact the clinic immediately if the expected date changes.</p>
  <div class="signature-row"><div>Ordered by / Dentist signature</div><div>Received by laboratory</div></div>`
}

function cashSales(clinic: MedicalCertificateClinic) {
  const clinicName = resolveClinicName(clinic.name)
  const phones = [clinic.phone, clinic.alternatePhone].filter(Boolean).join(' / ')
  const isBerhanu = /berhanu\s+belta/i.test(clinicName)
  const tin = isBerhanu ? '0045234069' : clinic.registrationNo || ''
  const registration = isBerhanu ? '364/367ዑ103/10' : ''
  return `<header class="receipt-head">${clinic.nameAm ? `<div class="am">${e(clinic.nameAm)}</div>` : ''}<h1>${e(clinicName.replace('Dental Clinic', 'Clinic Service'))}</h1><p>☎ ${e(phones)}</p></header>
  <section class="receipt-top"><div class="issuer"><p class="am">ከ ${e(clinicName)}<br><span style="font-size:11px">From</span></p><p class="am">አድራሻ፡- ክ/ከ ወረዳ 09<br>የፈቃድ ቁ. <u>${e(registration)}</u></p><p>Address:- K/K &nbsp;&nbsp;&nbsp; W &nbsp;&nbsp;&nbsp; H.No</p><p class="am">የታክስ ከፋይ መ.ቁ <u>${e(tin)}</u><br><span style="font-size:11px">Tin No</span></p></div><div class="receipt-fields"><div class="serial"><span>Date ________</span><span>No <strong>035</strong></span></div>${line('F.S No.')}${line('Date')}${line('Time')}${line('Buyer’s Name')}${line('Buyer’s Trade Name')}${line('Buyer’s TIN. No')}${line('Buyer’s VAT Reg. No')}${line('Address: Zone/S.C___ Kebele___ H.No.___')}</div></section>
  <div class="title receipt-title">Attachment Cash Sales Invoice</div><div class="attachment-mark">ATTACHMENT</div>
  <table><thead><tr><th style="width:12mm"><span class="am">ኮድ</span><br>Code</th><th><span class="am">የእቃው/አገልግሎት ዝርዝር</span><br>Description</th><th style="width:12mm"><span class="am">መለኪያ</span><br>Unit</th><th style="width:10mm"><span class="am">ብዛት</span><br>Qty</th><th style="width:20mm"><span class="am">የአንዱ ዋጋ</span><br>Unit Price</th><th style="width:24mm"><span class="am">ጠቅላላ ዋጋ</span><br>Total Price</th></tr></thead><tbody>${Array.from({ length: 8 }, () => '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
  <section class="receipt-bottom"><div style="display:grid;grid-template-columns:1fr 36mm;gap:4mm;margin-top:1mm">${line('<span class="am">በፊደል</span><br>In Words')}<div class="field"><span><span class="am">ድምር</span><br>Total</span><b></b></div></div><div class="field"><span><span class="am">የክፍያው ሁኔታ</span> / Mode of Payment</span><b style="border:0"></b><span class="check">Cash</span><span class="check">Check</span><span>Check No.</span><b></b></div><div class="signature-row"><div><span class="am">ያዘጋጀው ሰው ፊርማ</span><br>Prepared by</div><div><span class="am">የገንዘብ ተቀባይ ፊርማ</span><br>Cashier’s Signature</div></div><p class="mrc">MRC CFF00006511</p><p class="invalid">Invalid without fiscal or refund receipt attachment</p><div class="distribution"><span>Dist:- &nbsp; Original - Customer</span><span>1st Copy Account</span><span>2nd Copy Pad</span></div></section>`
}

function treatmentSheet(clinic: MedicalCertificateClinic) {
  const rows = [
    'T°c',
    'BP',
    'SpO₂',
    'PR',
    'C/C',
    'HPI',
    '',
    'PMX',
    'PDX',
    'EOE',
    'IOE',
    '',
    'ASS',
    'RXP',
    '',
    'APPT',
  ]
  return `${masthead(clinic)}<div class="title">Patient Clinical Treatment Sheet</div>
  <div class="grid three">${line('Patient name')}${line('Age / Sex')}${line('Card No.')}${line('Address')}${line('Woreda')}${line('Phone')}</div>
  <table style="margin-top:5mm"><thead><tr><th style="width:30mm">Date</th><th>Treatment / Clinical notes</th></tr></thead><tbody>${rows.map((label) => `<tr><td></td><td>${label ? `<strong>${label}</strong>` : ''}</td></tr>`).join('')}</tbody></table>
  <div class="signature-row" style="grid-template-columns:1fr"><div>Doctor name, signature and date</div></div>`
}

export function renderClinicPrintableHtml(
  key: ClinicPrintableKey,
  clinic: MedicalCertificateClinic
) {
  const content =
    key === 'consent'
      ? consent(clinic)
      : key === 'laboratory-order'
        ? laboratoryOrder(clinic)
        : key === 'cash-sales-attachment'
          ? cashSales(clinic)
          : treatmentSheet(clinic)
  const pageCss = key === 'cash-sales-attachment' ? '@page{size:A5 portrait;margin:5mm}' : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(CLINIC_PRINTABLES[key])}</title><style>${baseCss}${pageCss}</style></head><body class="${e(key)}"><div class="toolbar"><button onclick="window.print()">Print form</button></div><main class="paper">${content}</main></body></html>`
}

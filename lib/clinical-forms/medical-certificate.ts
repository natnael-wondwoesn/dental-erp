import { resolveClinicName } from '@/lib/branding'

export const MEDICAL_CERTIFICATE_TEMPLATE_NAME = 'Medical Certificate'

export interface MedicalCertificateData {
  certificateNo: string
  patientId: string
  patientFullName: string
  patientEmail?: string
  sex?: string
  age?: string
  cardNo: string
  city?: string
  subCity?: string
  woreda?: string
  examinedAt: string
  dentalDiagnosis: string
  medicalDiagnosis?: string
  recommendation: string
  leaveFrom?: string
  leaveTo?: string
  physicianName: string
  physicianQualification?: string
  physicianRegistration?: string
}

export interface MedicalCertificateClinic {
  name: string
  logo?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  alternatePhone?: string | null
  email?: string | null
  registrationNo?: string | null
}

function e(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function value(content?: string) {
  return `<span class="value">${e(content || ' ')}</span>`
}

function toothLogo() {
  return `<svg class="tooth-logo" viewBox="0 0 64 72" aria-hidden="true"><path d="M18 7c6 0 9 4 14 4s8-4 14-4c9 0 14 8 12 18-2 8-7 12-9 21-2 10-3 19-8 19-6 0-4-17-9-17s-3 17-9 17c-5 0-6-9-8-19-2-9-7-13-9-21C4 15 9 7 18 7Z"/><path d="M21 25c3 4 7 6 11 6s8-2 11-6M23 39h18"/></svg>`
}

export function renderMedicalCertificateHtml(
  data: MedicalCertificateData,
  clinic: MedicalCertificateClinic
): string {
  const clinicName = resolveClinicName(clinic.name)
  const phones = [clinic.phone, clinic.alternatePhone].filter(Boolean).join(' / ')
  const findings = [data.dentalDiagnosis, data.medicalDiagnosis].filter(Boolean).join(' — ')
  const leave = [data.leaveFrom, data.leaveTo].filter(Boolean).join(' to ')
  const logo = clinic.logo ? `<img class="logo" src="${e(clinic.logo)}" alt="" />` : toothLogo()

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(data.certificateNo)} — Medical Certificate</title>
<style>
@page{size:A5 portrait;margin:7mm}*{box-sizing:border-box}body{margin:0;background:#e9ecef;color:#213b73;font-family:Georgia,'Times New Roman',serif}.toolbar{width:148mm;margin:14px auto 0;display:flex;justify-content:flex-end}.toolbar button{border:0;border-radius:999px;background:#213b73;color:#fff;padding:10px 18px;font:600 13px system-ui;cursor:pointer}.paper{width:148mm;min-height:210mm;margin:14px auto;padding:9mm 10mm 8mm;background:#fff;box-shadow:0 16px 45px #17233c2b}.masthead{display:grid;grid-template-columns:17mm 1fr;align-items:center;gap:3mm;text-align:center}.logo,.tooth-logo{width:15mm;height:17mm;object-fit:contain}.tooth-logo{fill:none;stroke:#49649b;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.clinic-am{font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:12px;font-weight:700;line-height:1.25}.clinic-en{font:700 13px/1.25 Arial,sans-serif;letter-spacing:.02em;text-transform:uppercase}.phones{font:12px/1.35 Arial,sans-serif;letter-spacing:.03em}.card-row{display:flex;justify-content:flex-end;margin-top:5mm}.card{width:55mm;font-size:10px}.am-label{font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:9px}.card-line{display:flex;align-items:end;gap:2mm}.card-line .value{min-height:5mm}.title{text-align:center;margin:6mm 0}.title .am-title{font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:14px;font-weight:700}.title h1{display:inline-block;margin:1mm 0 0;border-bottom:1.5px solid #213b73;font-size:20px;line-height:1.1;text-transform:uppercase}.row{display:flex;align-items:end;gap:2mm;min-height:8mm;font-size:11px}.row .label{white-space:nowrap}.row .value{flex:1;min-height:6mm;border-bottom:1px solid #60749c;padding:0 1.5mm 1mm;color:#111;font:10px/1.3 Arial,sans-serif}.patient{display:grid;grid-template-columns:1fr 28mm 28mm;gap:3mm}.stack{margin-top:2mm}.stack .row{min-height:12mm}.recommendation{margin-top:2mm}.recommendation .row{align-items:start;min-height:32mm}.recommendation .label{padding-top:2mm}.recommendation .value{min-height:30mm;white-space:pre-wrap}.outcome{margin-top:6mm;padding-left:18mm}.outcome .row{min-height:11mm}.signature{width:67mm;margin:13mm auto 0;text-align:center}.signature .rule{border-top:1px solid #60749c}.signature .am-label{margin-top:2mm}.signature .en{font-size:11px}.doctor{color:#111;font:9px/1.35 Arial,sans-serif}.print-note{text-align:center;color:#667085;font:8px Arial,sans-serif;margin-top:7mm}@media print{html,body{width:148mm;min-height:210mm;background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.print-note{display:none}}
</style></head><body><div class="toolbar"><button onclick="window.print()">Print certificate</button></div><main class="paper">
<header class="masthead">${logo}<div><div class="clinic-am">ዶ/ር ለምለም ልዩ የጥርስ ሕክምና ክሊኒክ</div><div class="clinic-en">${e(clinicName)}</div><div class="phones">${e(phones)}</div></div></header>
<div class="card-row"><div class="card"><div class="am-label">የካርድ ቁጥር</div><div class="card-line"><span>CARD No.</span>${value(data.cardNo)}</div></div></div>
<div class="title"><div class="am-title">የሕክምና የምስክር ወረቀት</div><h1>Medical Certificate</h1></div>
<section class="patient"><div class="row"><span class="label"><span class="am-label">አቶ/ወ/ሮ</span><br>Mr/Mrs</span>${value(data.patientFullName)}</div><div class="row"><span class="label"><span class="am-label">ዕድሜ</span><br>Age</span>${value(data.age)}</div><div class="row"><span class="label"><span class="am-label">ፆታ</span><br>Sex</span>${value(data.sex)}</div></section>
<section class="stack"><div class="row"><span class="label"><span class="am-label">የተመረመሩት / የታከሙበት ቀን</span><br>Examined &amp;/or Treated</span>${value(data.examinedAt)}</div><div class="row"><span class="label"><span class="am-label">የምርመራ ውጤት</span><br>And Found to have</span>${value(findings)}</div></section>
<section class="recommendation"><div class="row"><span class="label"><span class="am-label">የሐኪሙ ትእዛዝ</span><br>Doctor’s Recommendation</span>${value(data.recommendation)}</div></section>
<section class="outcome"><div class="row"><span class="label"><span class="am-label">የተፈቀደላቸው ዕረፍት</span><br>Rest Recommendation</span>${value(leave)}</div><div class="row"><span class="label"><span class="am-label">ለሥራ ብቁ የሚሆኑበት</span><br>Fit for work</span>${value(data.leaveTo)}</div></section>
<section class="signature"><div class="doctor">${e(data.physicianName)}${data.physicianQualification ? ` · ${e(data.physicianQualification)}` : ''}${data.physicianRegistration ? ` · ${e(data.physicianRegistration)}` : ''}</div><div class="rule"></div><div class="am-label">የሐኪሙ ፊርማና ማህተም</div><div class="en">Dr. Signature &amp; Stamp</div></section><div class="print-note">${e(data.certificateNo)}</div>
</main></body></html>`
}

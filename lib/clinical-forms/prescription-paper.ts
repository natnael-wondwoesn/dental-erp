import type { MedicalCertificateClinic } from './medical-certificate'
import { resolveClinicEmail, resolveClinicName } from '@/lib/branding'

export interface PrescriptionPaperData {
  prescriptionNo: string
  createdAt: string
  patient: {
    fullName: string
    patientId: string
    sex?: string
    age?: string
    phone?: string
    email?: string
    address?: string
  }
  diagnosis?: string
  medications: Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
    route?: string
    timing?: string
    instructions?: string
    quantity?: string
  }>
  notes?: string
  prescriber: { name: string; qualification?: string; registration?: string }
}

function e(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderPrescriptionPaperHtml(
  data: PrescriptionPaperData,
  clinic: MedicalCertificateClinic
): string {
  const clinicName = resolveClinicName(clinic.name)
  const clinicEmail = resolveClinicEmail(clinic.email)
  const rows = data.medications
    .map(
      (medication, index) =>
        `<tr><td>${index + 1}</td><td><strong>${e(medication.name)}</strong>${medication.instructions ? `<br><small>${e(medication.instructions)}</small>` : ''}</td><td>${e(medication.dosage)}</td><td>${e(medication.frequency)}</td><td>${e(medication.duration)}</td><td>${e(medication.quantity || '')}</td></tr>`
    )
    .join('')
  const blankRows = Array.from(
    { length: Math.max(0, 7 - data.medications.length) },
    () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>'
  ).join('')
  const logo = clinic.logo
    ? `<img class="logo" src="${e(clinic.logo)}" alt="" />`
    : '<div class="logo-fallback">SS</div>'

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(data.prescriptionNo)} — Prescription Paper</title><style>
  @page{size:A4;margin:11mm}*{box-sizing:border-box}body{margin:0;background:#e8edf2;color:#101828;font-family:Georgia,'Times New Roman',serif}.toolbar{width:210mm;margin:16px auto 0;display:flex;justify-content:flex-end}.toolbar button{border:0;border-radius:999px;background:#0b6fe8;color:#fff;padding:11px 20px;font:600 14px system-ui;cursor:pointer}.paper{width:210mm;min-height:297mm;margin:16px auto;padding:15mm 15mm 13mm;background:white;box-shadow:0 20px 55px rgba(15,35,60,.16)}.header{display:grid;grid-template-columns:24mm 1fr auto;gap:7mm;align-items:center;border-bottom:2px solid #18314f;padding-bottom:6mm}.logo,.logo-fallback{width:23mm;height:23mm;object-fit:contain;border-radius:3mm}.logo-fallback{display:grid;place-items:center;background:#0b6fe8;color:#fff;font:700 23px system-ui}.am{font-family:'Noto Sans Ethiopic',Arial,sans-serif;font-size:14px;font-weight:700}.clinic{font-size:17px;font-weight:700;text-transform:uppercase}.contact{text-align:right;font:9px/1.45 Arial,sans-serif;color:#53657a}.title{text-align:center;font-size:22px;margin:10mm 0 2mm}.rxno{text-align:center;font:10px Arial,sans-serif;color:#667085;margin-bottom:8mm}.patient-grid{display:grid;grid-template-columns:2fr .65fr .65fr 1fr;gap:5mm;margin-bottom:5mm}.line{display:flex;align-items:end;gap:2mm;min-width:0}.line span:first-child{white-space:nowrap;font-size:12px}.value{flex:1;min-height:6mm;padding:0 1.5mm 1mm;border-bottom:1px dotted #344054;font:11px Arial,sans-serif;overflow-wrap:anywhere}.second{display:grid;grid-template-columns:2.2fr 1.3fr .65fr .65fr .55fr;gap:3mm;margin-bottom:7mm}.check{font:10px Arial,sans-serif;white-space:nowrap}.box{display:inline-block;width:4mm;height:4mm;border:1px solid #111;vertical-align:-.7mm;margin-left:1mm}.diagnosis{display:flex;gap:3mm;margin:6mm 0}.diagnosis .value{min-height:10mm}.rx{font-size:28px;font-weight:700;margin:3mm 0}.meds{width:100%;border-collapse:collapse;font:10px/1.25 Arial,sans-serif}.meds th,.meds td{border:1px solid #344054;padding:2.5mm;vertical-align:top}.meds th{text-align:left;background:#f4f7fa}.meds th:nth-child(1){width:7mm}.meds th:nth-child(3),.meds th:nth-child(4),.meds th:nth-child(5){width:24mm}.meds th:last-child{width:13mm}.meds tbody tr{height:11mm}.notes{margin-top:5mm;font:10px/1.5 Arial,sans-serif}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:12mm;margin-top:17mm;font:10px Arial,sans-serif}.signature-title{text-align:center;font:700 12px Georgia,serif;margin-bottom:8mm}.sig-line{border-bottom:1px dotted #344054;min-height:7mm;margin-bottom:2mm}.footer{margin-top:11mm;padding-top:4mm;border-top:1px solid #d0d5dd;text-align:center;font:9px Arial,sans-serif;color:#667085}@media print{body{background:#fff}.toolbar{display:none}.paper{margin:0;box-shadow:none}}</style></head><body>
  <style>@media print{@page{size:A4;margin:8mm}html,body{width:100%;height:auto;background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.header{grid-template-columns:19mm 1fr auto;gap:4mm;padding-bottom:3.5mm}.logo,.logo-fallback{width:18mm;height:18mm}.am{font-size:11px}.clinic{font-size:15px}.contact{font-size:7.5px}.title{font-size:18px;margin:5mm 0 1mm}.rxno{margin-bottom:4mm}.patient-grid{gap:3mm;margin-bottom:3mm}.line span:first-child{font-size:10px}.value{min-height:4.5mm;padding-bottom:.7mm;font-size:9px}.second{gap:2mm;margin-bottom:3mm}.check{font-size:8.5px}.box{width:3mm;height:3mm}.diagnosis{margin:3mm 0}.diagnosis .value{min-height:6mm}.rx{font-size:22px;margin:1.5mm 0}.meds{font-size:8px;line-height:1.15}.meds th,.meds td{padding:1.2mm}.meds tbody tr{height:7mm}.notes{margin-top:2.5mm;font-size:8px;line-height:1.3}.signatures{gap:8mm;margin-top:7mm;font-size:8px}.signature-title{font-size:10px;margin-bottom:3mm}.sig-line{min-height:4.5mm;margin-bottom:1mm}.footer{margin-top:5mm;padding-top:2mm;font-size:7px}}</style>
  <div class="toolbar"><button onclick="window.print()">Print prescription</button></div><main class="paper"><header class="header">${logo}<div><div class="am">ሰኒ ስማይል ስፔሻሊቲ የጥርስ ክሊኒክ</div><div class="clinic">${e(clinicName)}</div></div><div class="contact">${e([clinic.address, clinic.city].filter(Boolean).join(', '))}<br>${e(clinic.phone || '')}<br>${e(clinicEmail)}</div></header>
  <h1 class="title">Prescription Paper</h1><div class="rxno">${e(data.prescriptionNo)} · ${e(new Date(data.createdAt).toLocaleDateString('en-GB'))}</div>
  <section class="patient-grid"><div class="line"><span>Patient's full name</span><span class="value">${e(data.patient.fullName)}</span></div><div class="line"><span>Sex</span><span class="value">${e(data.patient.sex)}</span></div><div class="line"><span>Age</span><span class="value">${e(data.patient.age)}</span></div><div class="line"><span>Card No.</span><span class="value">${e(data.patient.patientId)}</span></div></section>
  <section class="second"><div class="line"><span>House / address</span><span class="value">${e(data.patient.address)}</span></div><div class="line"><span>Tel. No.</span><span class="value">${e(data.patient.phone)}</span></div><div class="check">Inpatient <span class="box"></span></div><div class="check">Outpatient <span class="box"></span></div><div class="check">Other <span class="box"></span></div></section>
  <div class="diagnosis"><span>Diagnosis if not ICD</span><span class="value">${e(data.diagnosis)}</span></div><div class="rx">℞</div>
  <table class="meds"><thead><tr><th>#</th><th>Drug name, strength, dosage form and instructions</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Qty</th></tr></thead><tbody>${rows}${blankRows}</tbody></table>
  ${data.notes ? `<div class="notes"><strong>Additional notes:</strong> ${e(data.notes)}</div>` : ''}
  <section class="signatures"><div><div class="signature-title">Prescriber's</div><div class="sig-line">${e(data.prescriber.name)}</div><div class="sig-line">${e(data.prescriber.qualification)}</div><div class="sig-line">${e(data.prescriber.registration)}</div><div class="sig-line"></div><div>Signature &amp; date</div></div><div><div class="signature-title">Evaluator's</div><div class="sig-line"></div><div class="sig-line"></div><div class="sig-line"></div><div class="sig-line"></div></div><div><div class="signature-title">Counsellor's</div><div class="sig-line"></div><div class="sig-line"></div><div class="sig-line"></div><div class="sig-line"></div></div></section>
  <footer class="footer">Issued by ${e(clinicName)} · ${e(data.prescriptionNo)}</footer></main></body></html>`
}

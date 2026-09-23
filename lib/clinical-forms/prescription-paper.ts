import type { MedicalCertificateClinic } from './medical-certificate'
import { resolveClinicName } from '@/lib/branding'

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
    region?: string
    town?: string
    woreda?: string
    kebele?: string
    houseNo?: string
    weight?: string
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

function medText(medication: PrescriptionPaperData['medications'][number]) {
  return [
    medication.name,
    medication.dosage,
    medication.frequency,
    medication.duration,
    medication.quantity ? `Qty ${medication.quantity}` : '',
    medication.route,
    medication.timing,
    medication.instructions,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function renderPrescriptionPaperHtml(
  data: PrescriptionPaperData,
  clinic: MedicalCertificateClinic
): string {
  const clinicName = resolveClinicName(clinic.name)
  const date = new Date(data.createdAt).toLocaleDateString('en-GB')
  const rows = Array.from({ length: Math.max(8, data.medications.length) }, (_, index) => {
    const medication = data.medications[index]
    return `<tr><td>${medication ? e(medText(medication)) : '&nbsp;'}</td><td></td><td></td></tr>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(data.prescriptionNo)} — Prescription Paper</title><style>
@page{size:A5 portrait;margin:6mm}*{box-sizing:border-box}body{margin:0;background:#e9ecef;color:#223c73;font-family:Georgia,'Times New Roman',serif}.toolbar{width:148mm;margin:14px auto 0;display:flex;justify-content:flex-end}.toolbar button{border:0;border-radius:999px;background:#223c73;color:#fff;padding:10px 18px;font:600 13px system-ui;cursor:pointer}.paper{position:relative;width:148mm;min-height:210mm;margin:14px auto;padding:7mm 8mm 6mm;background:#fff;box-shadow:0 16px 45px #17233c2b}.stub,.heading{text-align:center}.stub{font-size:9px}.stub .clinic{font-size:10px}.dotted{border-top:1px dotted #223c73;margin:3mm 0}.heading{position:relative}.paper-title{display:inline-block;border-bottom:1px solid #223c73;font-size:12px;letter-spacing:.03em}.vra{margin-left:7mm}.clinic{margin-top:1.5mm;font:700 13px Arial,sans-serif}.numbers{position:absolute;right:0;top:0;width:34mm;text-align:left;font-size:9px;line-height:1.7}.line{display:flex;align-items:end;gap:1.5mm;min-width:0}.line label{white-space:nowrap}.value{flex:1;min-height:4.5mm;border-bottom:1px solid #60749c;padding:0 1mm .7mm;color:#111;font:8px Arial,sans-serif;overflow-wrap:anywhere}.patient-a{display:grid;grid-template-columns:2.2fr .8fr 1.1fr;gap:3mm;margin-top:9mm;font-size:9px}.patient-b{display:grid;grid-template-columns:1fr .9fr 1.1fr;gap:3mm;margin-top:1mm;font-size:9px}.checks{display:grid;grid-template-columns:1fr 1fr;gap:1mm 5mm;margin-left:72mm;font-size:8px}.check{display:inline-block;width:3.4mm;height:3.4mm;border:1px solid #223c73;margin-right:1.5mm;vertical-align:-.7mm}.diagnosis{margin-top:3mm;font-size:9px}.address{display:grid;grid-template-columns:1.1fr .8fr .8fr;gap:2mm;margin-top:2mm;font-size:8px}.address.second{grid-template-columns:1fr 1fr 1fr}.meds{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:3mm;font:7px/1.12 Arial,sans-serif;color:#223c73}.meds th,.meds td{border:1px solid #526a99;padding:.8mm 1mm;vertical-align:top;overflow-wrap:anywhere}.meds th{text-align:left;font:700 8px/1.2 Georgia,serif}.meds th:nth-child(2){width:28mm}.meds th:nth-child(3){width:9mm}.meds tbody tr{height:5.5mm}.total td{height:5mm;font-weight:700}.rx{font-size:12px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin-top:2mm;font-size:8px}.sig-title{font-weight:700;margin-bottom:1mm}.sig-line{display:flex;align-items:end;gap:1mm;min-height:6mm}.sig-line .value{min-height:4mm}.vertical-note{position:absolute;right:2mm;bottom:17mm;writing-mode:vertical-rl;font-size:7px}.print-id{text-align:center;margin-top:2mm;color:#667085;font:7px Arial,sans-serif}@media print{html,body{width:148mm;min-height:210mm;background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.print-id{display:none}}
</style></head><body><div class="toolbar"><button onclick="window.print()">Print prescription</button></div><main class="paper">
<div class="stub"><span class="paper-title">PRESCRIPTION PAPER</span><span class="vra">12&nbsp; VRA</span><div class="clinic">${e(clinicName)}</div><div style="text-align:right">No ______ &nbsp; Card No ______</div></div><div class="dotted"></div>
<header class="heading"><span class="paper-title">PRESCRIPTION PAPER</span><span class="vra">12&nbsp; VRA</span><div class="clinic">${e(clinicName)}</div><div class="numbers">No ______<br>Card No ${e(data.patient.patientId)}</div></header>
<section class="patient-a"><div class="line"><label>Patient’s Name</label><span class="value">${e(data.patient.fullName)}</span></div><div class="line"><label>Sex</label><span class="value">${e(data.patient.sex)}</span></div><div class="line"><label>Date</label><span class="value">${e(date)}</span></div></section>
<section class="patient-b"><div class="line"><label>Weight</label><span class="value">${e(data.patient.weight)}</span></div><div class="line"><label>Card No.</label><span class="value">${e(data.patient.patientId)}</span></div><div class="line"><label>Age</label><span class="value">${e(data.patient.age)}</span></div></section>
<section class="checks"><div><span class="check"></span>Inpatient</div><div><span class="check"></span>Outpatient</div><div><span class="check"></span>Start</div><div><span class="check"></span>Refill</div></section>
<div class="line diagnosis"><label>Diagnosis (ICD code No.)</label><span class="value">${e(data.diagnosis)}</span></div>
<section class="address"><div class="line"><label>Address: Region</label><span class="value">${e(data.patient.region)}</span></div><div class="line"><label>Town</label><span class="value">${e(data.patient.town)}</span></div><div class="line"><label>Woreda</label><span class="value">${e(data.patient.woreda)}</span></div></section><section class="address second"><div class="line"><label>Kebele</label><span class="value">${e(data.patient.kebele)}</span></div><div class="line"><label>House No.</label><span class="value">${e(data.patient.houseNo)}</span></div><div class="line"><label>Tel. No.</label><span class="value">${e(data.patient.phone)}</span></div></section>
<table class="meds"><thead><tr><th>Treatment given&nbsp; (Drug Name, Strength,<br>Dosage form, dose, duration, and quantity)</th><th>Price of each item<br><small>(for dispenser’s use only)</small></th><th></th></tr></thead><tbody><tr><td class="rx">Rx</td><td></td><td></td></tr>${rows}<tr class="total"><td style="text-align:right">TOTAL</td><td></td><td></td></tr></tbody></table>
<section class="signatures"><div><div class="sig-title">Prescriber’s</div><div class="sig-line"><label>Full name</label><span class="value">${e(data.prescriber.name)}</span></div><div class="sig-line"><label>Qualification</label><span class="value">${e(data.prescriber.qualification)}</span></div><div class="sig-line"><label>Registration</label><span class="value">${e(data.prescriber.registration)}</span></div><div class="sig-line"><label>Signature</label><span class="value"></span></div></div><div><div class="sig-title">Dispenser’s</div><div class="sig-line"><span class="value"></span></div><div class="sig-line"><span class="value"></span></div><div class="sig-line"><span class="value"></span></div></div></section><div class="vertical-note">*see overleaf</div><div class="print-id">${e(data.prescriptionNo)}</div>
</main></body></html>`
}

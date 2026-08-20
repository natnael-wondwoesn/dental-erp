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
  email?: string | null
  registrationNo?: string | null
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function line(label: string, value?: string, wide = false) {
  return `<div class="line ${wide ? 'wide' : ''}"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value || ' ')}</span></div>`
}

export function renderMedicalCertificateHtml(
  data: MedicalCertificateData,
  clinic: MedicalCertificateClinic
): string {
  const clinicName = clinic.name || 'Sunny Smile Speciality Clinic'
  const logo = clinic.logo
    ? `<img class="logo" src="${escapeHtml(clinic.logo)}" alt="" />`
    : `<div class="logo-fallback">SS</div>`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(data.certificateNo)} — Medical Certificate</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #101828; background: #eef2f6; font-family: Georgia, 'Times New Roman', serif; }
    .toolbar { max-width: 210mm; margin: 16px auto 0; display: flex; justify-content: flex-end; }
    .toolbar button { border: 0; border-radius: 999px; background: #0b6fe8; color: white; padding: 11px 20px; font: 600 14px system-ui; cursor: pointer; }
    .paper { width: 210mm; min-height: 297mm; margin: 16px auto; padding: 18mm 17mm; background: white; box-shadow: 0 20px 55px rgba(15, 35, 60, .16); }
    .header { display: grid; grid-template-columns: 25mm 1fr auto; gap: 8mm; align-items: center; border-bottom: 2px solid #18314f; padding-bottom: 7mm; }
    .logo,.logo-fallback { width: 24mm; height: 24mm; object-fit: contain; border-radius: 4mm; }
    .logo-fallback { display: grid; place-items: center; color: white; background: #0b6fe8; font: 700 24px system-ui; }
    .amharic { font-family: 'Noto Sans Ethiopic', Arial, sans-serif; font-size: 15px; font-weight: 700; }
    .clinic { font-size: 21px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
    .contact { text-align: right; font: 10px/1.5 Arial, sans-serif; color: #53657a; }
    .title { margin: 14mm 0 4mm; text-align: center; font-size: 24px; font-weight: 700; }
    .document-no { text-align: center; font: 11px Arial, sans-serif; color: #607086; margin-bottom: 10mm; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm 7mm; }
    .line { min-height: 9mm; display: flex; gap: 3mm; align-items: end; }
    .line.wide { grid-column: 1 / -1; }
    .label { flex: none; font-size: 13px; white-space: nowrap; }
    .value { flex: 1; min-height: 7mm; border-bottom: 1px dotted #344054; padding: 0 2mm 1.5mm; font: 12px/1.4 Arial, sans-serif; }
    .section { margin-top: 9mm; }
    .section-title { font-size: 13px; margin-bottom: 2mm; }
    .answer { min-height: 18mm; border-bottom: 1px dotted #667085; padding: 2mm 1mm; white-space: pre-wrap; font: 12px/1.55 Arial, sans-serif; }
    .answer.tall { min-height: 27mm; }
    .leave { margin-top: 8mm; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; padding: 5mm; background: #f4f8fc; border: 1px solid #d4e1ee; border-radius: 3mm; }
    .signature { margin-top: 18mm; margin-left: auto; width: 78mm; }
    .signature .rule { margin-top: 13mm; border-top: 1px solid #101828; }
    .signature p { margin: 1.5mm 0; font: 11px Arial, sans-serif; }
    .footer { margin-top: 16mm; padding-top: 4mm; border-top: 1px solid #d0d5dd; text-align: center; font: 9px Arial, sans-serif; color: #667085; }
    @media print { body { background: white; } .toolbar { display: none; } .paper { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print certificate</button></div>
  <main class="paper">
    <header class="header">
      ${logo}
      <div><div class="amharic">ሰኒ ስማይል ስፔሻሊቲ የጥርስ ክሊኒክ</div><div class="clinic">${escapeHtml(clinicName)}</div></div>
      <div class="contact">${escapeHtml([clinic.address, clinic.city].filter(Boolean).join(', '))}<br>${escapeHtml(clinic.phone || '')}<br>${escapeHtml(clinic.email || '')}</div>
    </header>
    <h1 class="title">Medical Certificate</h1>
    <div class="document-no">Certificate No. ${escapeHtml(data.certificateNo)}</div>
    <section class="grid">
      ${line("Patient's full name", data.patientFullName, true)}
      ${line('Sex', data.sex)}${line('Age', data.age)}${line('Card No.', data.cardNo)}
      ${line('City', data.city)}${line('Sub City', data.subCity)}${line('Woreda', data.woreda)}
      ${line('Date examined and treated', data.examinedAt, true)}
    </section>
    <section class="section"><div class="section-title">Dental diagnosis</div><div class="answer">${escapeHtml(data.dentalDiagnosis)}</div></section>
    <section class="section"><div class="section-title">Medical diagnosis</div><div class="answer">${escapeHtml(data.medicalDiagnosis || 'No additional medical diagnosis recorded.')}</div></section>
    <section class="section"><div class="section-title">Recommendation</div><div class="answer tall">${escapeHtml(data.recommendation)}</div></section>
    ${data.leaveFrom || data.leaveTo ? `<section class="leave">${line('Medical leave from', data.leaveFrom)}${line('Return / leave through', data.leaveTo)}</section>` : ''}
    <section class="signature"><div class="rule"></div><p><strong>${escapeHtml(data.physicianName)}</strong></p><p>${escapeHtml(data.physicianQualification || 'Dental Surgeon')}</p><p>${data.physicianRegistration ? `Registration No. ${escapeHtml(data.physicianRegistration)}` : ''}</p><p>Signature &amp; clinic stamp</p></section>
    <footer class="footer">Issued by ${escapeHtml(clinicName)} · Verify using certificate number ${escapeHtml(data.certificateNo)}</footer>
  </main>
</body>
</html>`
}

// One-time, idempotent Berhanu clinic procedure catalog import.
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const hospitalId = process.argv[2]

if (!hospitalId) {
  console.error('Hospital id is required')
  process.exit(2)
}

const catalog = [
  ['BER-001', 'Card', 'DIAGNOSTIC', 200],
  ['BER-002', 'Scaling', 'PREVENTIVE', 1200],
  ['BER-003', 'Extraction (milk tooth)', 'ORAL_SURGERY', 700],
  ['BER-004', 'Extraction (permanent tooth)', 'ORAL_SURGERY', 1500],
  ['BER-005', 'Minor Surgery', 'ORAL_SURGERY', 5000],
  ['BER-006', 'Gum Treatment', 'PERIODONTIC', 1500],
  ['BER-007', '3rd Molar Extraction', 'ORAL_SURGERY', 5000],
  ['BER-008', 'Diagnosis & Treatment', 'DIAGNOSTIC', 500],
  ['BER-009', 'Filling (milk tooth)', 'RESTORATIVE', 1000],
  ['BER-010', 'Filling (composite)', 'RESTORATIVE', 2000],
  ['BER-011', 'Filling (GI)', 'RESTORATIVE', 1500],
  ['BER-012', 'Tooth Whitening', 'COSMETIC', 10000],
  ['BER-013', 'Fixed Orthodontic', 'ORTHODONTIC', 13000],
  ['BER-014', 'Orthodontic Retainer', 'ORTHODONTIC', 2000],
  ['BER-015', 'Dentures (per tooth)', 'PROSTHODONTIC', 3000],
  ['BER-016', 'Fixed Acrylic Tooth', 'PROSTHODONTIC', 2500],
  ['BER-017', 'Chromocobalt Tooth', 'PROSTHODONTIC', 4000],
  ['BER-018', 'Ceramic Tooth', 'PROSTHODONTIC', 7000],
  ['BER-019', 'Zirconia (per tooth)', 'PROSTHODONTIC', 13000],
  ['BER-020', 'Splinting', 'PERIODONTIC', 7000],
  ['BER-021', 'IMF', 'ORAL_SURGERY', 10000],
  ['BER-022', 'Soft Tissue Repair', 'ORAL_SURGERY', 1000],
  ['BER-023', 'Crown Refixing', 'PROSTHODONTIC', 600],
  ['BER-024', 'X-ray', 'DIAGNOSTIC', 700],
  ['BER-025', 'RCT', 'ENDODONTIC', 3000],
]

async function main() {
  const clinic = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { id: true },
  })
  if (!clinic) throw new Error('Clinic not found')

  const results = await prisma.$transaction(async (tx) => {
    const changed = []
    for (const [code, name, category, basePrice] of catalog) {
      const existing = await tx.procedure.findFirst({ where: { hospitalId, name } })
      if (existing) {
        const procedure = await tx.procedure.update({
          where: { id: existing.id },
          data: { category, basePrice, isActive: true },
        })
        changed.push({ action: 'updated', ...procedure })
      } else {
        const procedure = await tx.procedure.upsert({
          where: { hospitalId_code: { hospitalId, code } },
          update: { name, category, basePrice, isActive: true },
          create: {
            hospitalId,
            code,
            name,
            category,
            basePrice,
            defaultDuration: 30,
            isActive: true,
          },
        })
        changed.push({ action: 'created', ...procedure })
      }
    }
    return changed
  })

  console.log(
    JSON.stringify({
      count: results.length,
      created: results.filter((item) => item.action === 'created').length,
      updated: results.filter((item) => item.action === 'updated').length,
      procedures: results.map(({ code, name, category, basePrice }) => ({
        code,
        name,
        category,
        basePrice: String(basePrice),
      })),
    })
  )
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

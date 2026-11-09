// One-time, idempotent Megenagna clinic procedure catalog import.
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const hospitalId = process.argv[2]

if (!hospitalId) {
  console.error('Hospital id is required')
  process.exit(2)
}

// Prices are not agreed yet: every item loads at 0 and the clinic sets its own in Settings > Procedures.
const catalog = [
  ['MEG-001', 'Simple Extraction', 'ORAL_SURGERY'],
  ['MEG-002', 'Hard Extraction', 'ORAL_SURGERY'],
  ['MEG-003', 'Impacted Tooth Extraction', 'ORAL_SURGERY'],
  ['MEG-004', 'Pediatric Extraction', 'ORAL_SURGERY'],
  ['MEG-005', 'Anterior Filling', 'RESTORATIVE'],
  ['MEG-006', 'Posterior Filling', 'RESTORATIVE'],
  ['MEG-007', 'RCT - Anterior', 'ENDODONTIC'],
  ['MEG-008', 'RCT - Premolar', 'ENDODONTIC'],
  ['MEG-009', 'RCT - Molar', 'ENDODONTIC'],
  ['MEG-010', 'Pulpotomy', 'ENDODONTIC'],
  ['MEG-011', 'Pulpectomy', 'ENDODONTIC'],
  ['MEG-012', 'Denture per Unit', 'PROSTHODONTIC'],
  ['MEG-013', 'Full Denture', 'PROSTHODONTIC'],
  ['MEG-014', 'Fixable Denture', 'PROSTHODONTIC'],
  ['MEG-015', 'Denture Repair', 'PROSTHODONTIC'],
  ['MEG-016', 'Acrylic per Tooth', 'PROSTHODONTIC'],
  ['MEG-017', 'Chrome per Tooth', 'PROSTHODONTIC'],
  ['MEG-018', 'Porcelain Ceramic per Tooth', 'PROSTHODONTIC'],
  ['MEG-019', 'Metal Ceramic per Tooth', 'PROSTHODONTIC'],
  ['MEG-020', 'Zirconium', 'PROSTHODONTIC'],
  ['MEG-021', 'Fixed Brace', 'ORTHODONTIC'],
  ['MEG-022', 'Metallic Brace', 'ORTHODONTIC'],
  ['MEG-023', 'Ceramic Brace', 'ORTHODONTIC'],
  ['MEG-024', 'Preventive Orthodontics', 'ORTHODONTIC'],
  ['MEG-025', 'FOA (Functional Orthodontic Appliance)', 'ORTHODONTIC'],
  ['MEG-026', 'Plastic Retainer', 'ORTHODONTIC'],
  ['MEG-027', 'Wire Retainer', 'ORTHODONTIC'],
  ['MEG-028', 'IOPA X-ray', 'DIAGNOSTIC'],
  ['MEG-029', 'Panoramic X-ray', 'DIAGNOSTIC'],
  ['MEG-030', 'Simple Scaling', 'PREVENTIVE'],
  ['MEG-031', 'Deep Scaling', 'PREVENTIVE'],
]

async function main() {
  const clinic = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { id: true },
  })
  if (!clinic) throw new Error('Clinic not found')

  const results = await prisma.$transaction(async (tx) => {
    const changed = []
    for (const [code, name, category] of catalog) {
      const existing = await tx.procedure.findFirst({ where: { hospitalId, name } })
      if (existing) {
        const procedure = await tx.procedure.update({
          where: { id: existing.id },
          data: { category, isActive: true },
        })
        changed.push({ action: 'updated', ...procedure })
      } else {
        const procedure = await tx.procedure.upsert({
          where: { hospitalId_code: { hospitalId, code } },
          update: { name, category, isActive: true },
          create: {
            hospitalId,
            code,
            name,
            category,
            basePrice: 0,
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

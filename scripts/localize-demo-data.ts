import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const userMappings = [
  {
    emails: ['admin@demo-dental.com', 'admin@dentix.et'],
    nextEmail: 'admin@dentix.et',
    name: 'Mekdes Alemu',
    phone: '0911234500',
    employeeId: 'EMP001',
    firstName: 'Mekdes',
    lastName: 'Alemu',
    specialization: 'Clinic Operations',
    licenseNumber: 'AA-DEN-ADMIN-001',
  },
  {
    emails: ['doctor@demo-dental.com', 'doctor@dentix.et'],
    nextEmail: 'doctor@dentix.et',
    name: 'Dr. Selam Abebe',
    phone: '0911234501',
    employeeId: 'EMP002',
    firstName: 'Selam',
    lastName: 'Abebe',
    specialization: 'Orthodontics',
    licenseNumber: 'AA-DEN-ORTHO-014',
  },
  {
    emails: ['reception@demo-dental.com', 'reception@dentix.et'],
    nextEmail: 'reception@dentix.et',
    name: 'Hanna Tesfaye',
    phone: '0911234502',
    employeeId: 'EMP003',
    firstName: 'Hanna',
    lastName: 'Tesfaye',
    specialization: null,
    licenseNumber: null,
  },
] as const

const patientMappings = [
  ['PAT20240001', 'Selamawit', 'Bekele', '0911234601', 'FEMALE'],
  ['PAT20240002', 'Dawit', 'Tesfaye', '0911234602', 'MALE'],
  ['PAT20240003', 'Hana', 'Abebe', '0911234603', 'FEMALE'],
  ['PAT20240004', 'Natnael', 'Alemu', '0911234604', 'MALE'],
  ['PAT20240005', 'Bethlehem', 'Mekonnen', '0911234605', 'FEMALE'],
  ['PAT20240006', 'Samuel', 'Tadesse', '0911234606', 'MALE'],
  ['PAT20240007', 'Eden', 'Girma', '0911234607', 'FEMALE'],
  ['PAT20240008', 'Yonas', 'Hailu', '0911234608', 'MALE'],
  ['PAT20240009', 'Ruth', 'Kebede', '0911234609', 'FEMALE'],
  ['PAT20240010', 'Kalkidan', 'Wolde', '0911234610', 'FEMALE'],
] as const

const supplierMappings = [
  ['SUP001', 'Addis Dental Depot', 'Abel Getachew', '0911567801', 'sales@addisdental.example'],
  ['SUP002', 'Bole Ortho Supplies', 'Rahel Demissie', '0911567802', 'orders@boleortho.example'],
  ['SUP003', 'Legacy Instruments East Africa', 'Yonatan Fikru', '0911567803', null],
] as const

async function main() {
  const hospital = await prisma.hospital.findUnique({
    where: { slug: 'demo-dental-clinic' },
  })

  if (!hospital) {
    console.log('No demo clinic found. Nothing to localize.')
    return
  }

  await prisma.hospital.update({
    where: { id: hospital.id },
    data: {
      name: 'Dentix Bole Dental Clinic',
      email: 'hello@dentix.et',
      phone: '0116672211',
      address: 'Bole Road, near Edna Mall',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      pincode: '1000',
      tagline: 'Strong teeth, bright smile.',
      website: 'www.dentix.et',
      gstNumber: null,
      panNumber: null,
      registrationNo: 'AA-DEN-2024-0142',
      upiId: 'dentix@telebirr',
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
    },
  })

  for (const entry of userMappings) {
    const user = await prisma.user.findFirst({
      where: {
        hospitalId: hospital.id,
        email: { in: [...entry.emails] },
      },
      include: { staff: true },
    })

    if (!user) continue

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: entry.nextEmail,
        name: entry.name,
        phone: entry.phone,
      },
    })

    if (user.staff) {
      await prisma.staff.update({
        where: { id: user.staff.id },
        data: {
          employeeId: entry.employeeId,
          firstName: entry.firstName,
          lastName: entry.lastName,
          phone: entry.phone,
          email: entry.nextEmail,
          specialization: entry.specialization,
          licenseNumber: entry.licenseNumber,
          city: 'Addis Ababa',
          state: 'Addis Ababa',
        },
      })
    }
  }

  for (const [patientId, firstName, lastName, phone, gender] of patientMappings) {
    await prisma.patient.updateMany({
      where: { hospitalId: hospital.id, patientId },
      data: {
        firstName,
        lastName,
        phone,
        gender,
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        address: 'Bole Road',
        pincode: '1000',
      },
    })
  }

  for (const [code, name, contactPerson, phone, email] of supplierMappings) {
    await prisma.supplier.updateMany({
      where: { hospitalId: hospital.id, code },
      data: {
        name,
        contactPerson,
        phone,
        email,
        city: 'Addis Ababa',
        state: 'Addis Ababa',
      },
    })
  }

  console.log('Demo clinic localized for Ethiopian/Habesha context.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

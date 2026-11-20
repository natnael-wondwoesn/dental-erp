'use strict'
// Creates the clinic and its first administrator on an offline install.
// Sign-up pages are switched off in the full product, so this does what the
// sign-up route does, with the unlimited SELF_HOSTED plan. Reads JSON on stdin:
//   { hospitalName, adminName, phone, email?, password, address?, city? }
// Environment: DATABASE_URL (required), APP_DIR (folder holding node_modules/@prisma/client, default /app).
const path = require('path')

const appDir = process.env.APP_DIR || '/app'
const { PrismaClient } = require(path.join(appDir, 'node_modules', '@prisma', 'client'))
const bcrypt = require(path.join(__dirname, 'node_modules', 'bcryptjs'))

function fail(message) {
  console.error('ERROR: ' + message)
  process.exit(1)
}

function normalizeEthiopianPhone(value) {
  const compact = String(value)
    .trim()
    .replace(/[\s()-]/g, '')
  let normalized = compact
  if (normalized.startsWith('00251')) normalized = '+' + normalized.slice(2)
  else if (normalized.startsWith('0')) normalized = '+251' + normalized.slice(1)
  else if (normalized.startsWith('251')) normalized = '+' + normalized
  else if (/^9\d{8}$/.test(normalized)) normalized = '+251' + normalized
  return /^\+251[79]\d{8}$/.test(normalized) ? normalized : null
}

function slugify(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'clinic'
}

async function main(raw) {
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    fail('Input must be JSON.')
  }
  const hospitalName = String(input.hospitalName || '').trim()
  const adminName = String(input.adminName || '').trim()
  const password = String(input.password || '')
  const suppliedEmail = String(input.email || '')
    .trim()
    .toLowerCase()
  const phone = normalizeEthiopianPhone(input.phone || '')
  if (hospitalName.length < 2) fail('Clinic name must be at least 2 characters.')
  if (adminName.length < 2) fail('Administrator name must be at least 2 characters.')
  if (password.length < 8) fail('Password must be at least 8 characters.')
  if (!phone) fail('Enter a valid Ethiopian mobile number, for example 0911234567.')
  if (suppliedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail))
    fail('That email address is not valid.')

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.hospital.count()
    if (existing > 0) {
      fail(
        'A clinic already exists on this computer. Nothing was changed. (This install is for one clinic.)'
      )
    }
    const accountEmail = suppliedEmail || 'phone-' + phone.replace(/\D/g, '') + '@accounts.invalid'
    const hashed = await bcrypt.hash(password, 10)
    const [firstName, ...rest] = adminName.split(' ')
    const result = await prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.create({
        data: {
          name: hospitalName,
          slug: slugify(hospitalName),
          email: accountEmail,
          phone,
          address: input.address ? String(input.address) : null,
          city: input.city ? String(input.city) : null,
          plan: 'SELF_HOSTED',
          isActive: true,
          onboardingCompleted: false,
          patientLimit: -1,
          staffLimit: -1,
          storageLimitMb: -1,
        },
      })
      const user = await tx.user.create({
        data: {
          email: accountEmail,
          name: adminName,
          password: hashed,
          phone,
          role: 'ADMIN',
          isActive: true,
          isHospitalAdmin: true,
          hospitalId: hospital.id,
          staff: {
            create: {
              employeeId: 'EMP001',
              firstName,
              lastName: rest.join(' '),
              email: accountEmail,
              phone,
              hospitalId: hospital.id,
            },
          },
        },
      })
      return { hospital, user }
    })
    console.log(
      JSON.stringify({
        ok: true,
        hospitalId: result.hospital.id,
        hospitalName,
        loginIdentifier: suppliedEmail || phone,
      })
    )
  } finally {
    await prisma.$disconnect()
  }
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
  main(raw).catch((error) => fail(error && error.message ? error.message : String(error)))
})

import { prisma } from '../lib/prisma'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('Usage: npx tsx scripts/promote-platform-owner.ts owner@example.com')
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  })
  if (!user) throw new Error('User not found')
  if (user.role !== 'ADMIN') throw new Error('Platform owner must also be an ADMIN')
  await prisma.user.update({ where: { id: user.id }, data: { isPlatformOwner: true } })
  console.log(`Platform owner access enabled for ${user.email}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Promotion failed')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

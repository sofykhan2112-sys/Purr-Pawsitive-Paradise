import { prisma } from './db.js'

async function makeAdmin() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    throw new Error('Provide the email of the account to promote.')
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        _count: {
          select: { pets: true },
        },
      },
    })

    if (!user) {
      throw new Error('Account not found. Register it on the website first.')
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('This account is not active.')
    }

    if (user.role === 'ADMIN') {
      console.log('This account is already an administrator.')
      return
    }

    if (user.role !== 'OWNER' || user._count.pets > 0) {
      throw new Error(
        'Use a separate owner account without pets for administrator access.',
      )
    }

    await tx.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })

    await tx.auditEvent.create({
      data: {
        actorLabel: 'Local administrator setup script',
        action: 'USER_PROMOTED_TO_ADMIN',
        entityType: 'User',
        entityId: user.id,
        details: {
          previousRole: user.role,
          newRole: 'ADMIN',
        },
      },
    })

    console.log(`Administrator access enabled for ${user.email}`)
  })
}

makeAdmin()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Administrator setup failed.',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
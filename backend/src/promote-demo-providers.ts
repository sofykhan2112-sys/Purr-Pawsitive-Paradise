
import 'dotenv/config'
import { prisma } from './db.js'

const providers = [
  {
    email: 'demo.vet@example.com',
    role: 'VET' as const,
  },
  {
    email: 'hope@example.com',
    role: 'AMBULANCE_PROVIDER' as const,
  },
]

async function main() {
  

  for (const provider of providers) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: provider.email },
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
        throw new Error(
          `Account not found: ${provider.email}`,
        )
      }

      if (user.status !== 'ACTIVE') {
        throw new Error(
          `Account is not active: ${provider.email}`,
        )
      }

      if (user.role === provider.role) {
        console.log(
          `${provider.email} already has role ${provider.role}`,
        )
        return
      }

      if (user.role !== 'OWNER' || user._count.pets > 0) {
        throw new Error(
          `Cannot promote ${provider.email}: account is not an empty OWNER account.`,
        )
      }

      await tx.user.update({
        where: { id: user.id },
        data: { role: provider.role },
      })

      await tx.auditEvent.create({
        data: {
          actorLabel: 'One-time demo provider setup',
          action: 'USER_PROMOTED_TO_PROVIDER',
          entityType: 'User',
          entityId: user.id,
          details: {
            previousRole: user.role,
            newRole: provider.role,
          },
        },
      })

      console.log(
        `${provider.email} promoted to ${provider.role}`,
      )
    })
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Provider setup failed.',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

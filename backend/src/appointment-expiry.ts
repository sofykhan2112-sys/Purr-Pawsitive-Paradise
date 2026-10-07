import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'

type ExpiryScope =
  | { ownerId: string; providerUserId?: never }
  | { providerUserId: string; ownerId?: never }

export async function expirePendingRequests(scope: ExpiryScope) {
  const now = new Date()

  const dueWhere: Prisma.AppointmentWhereInput = {
    ...scope,
    status: 'REQUESTED',
    OR: [
      { requestedStartAt: { lte: now } },
      { responseDueAt: { lte: now } },
    ],
  }

  // Process a bounded batch on each list refresh.
  const candidates = await prisma.appointment.findMany({
    where: dueWhere,
    orderBy: [
      { requestedStartAt: 'asc' },
      { id: 'asc' },
    ],
    take: 100,
    select: {
      id: true,
      version: true,
      ownerId: true,
      providerUserId: true,
    },
  })

  for (const candidate of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.updateMany({
          where: {
            AND: [
              dueWhere,
              {
                id: candidate.id,
                version: candidate.version,
              },
            ],
          },
          data: {
            status: 'EXPIRED',
            version: { increment: 1 },
          },
        })

        // Another action may already have changed this appointment.
        if (updated.count !== 1) return

        await tx.appointmentEvent.create({
          data: {
            appointmentId: candidate.id,
            actorId: null,
            version: candidate.version + 1,
            action: 'APPOINTMENT_EXPIRED',
            notifications: {
                create: [
                  { userId: candidate.ownerId },
                  { userId: candidate.providerUserId },
                ],
              },
            previousStatus: 'REQUESTED',
            newStatus: 'EXPIRED',
            reason:
              'No provider response before the response deadline or requested start time.',
            details: {
              processedAt: now.toISOString(),
            },
          },
        })
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        // A concurrent action won. Recheck on the next list refresh.
        continue
      }

      throw error
    }
  }
}
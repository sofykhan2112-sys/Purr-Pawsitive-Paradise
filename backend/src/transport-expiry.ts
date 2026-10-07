import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'

export function startTransportExpiryWorker() {
  let running = false
  let stopped = false

  async function expireRequests() {
    if (running || stopped) return
    running = true

    try {
      const now = new Date()

      const candidates = await prisma.transportRequest.findMany({
        where: {
          status: 'REQUESTED',
          responseDueAt: { lte: now },
        },
        orderBy: [
          { responseDueAt: 'asc' },
          { id: 'asc' },
        ],
        take: 100,
        select: {
          id: true,
          version: true,
          responseDueAt: true,
        },
      })

      let expiredCount = 0

      for (const candidate of candidates) {
        if (stopped) break

        try {
          const expired = await prisma.$transaction(async (tx) => {
            const updated = await tx.transportRequest.updateMany({
              where: {
                id: candidate.id,
                version: candidate.version,
                status: 'REQUESTED',
                responseDueAt: { lte: now },
              },
              data: {
                status: 'EXPIRED',
                expiredAt: now,
                version: { increment: 1 },
              },
            })

            // Another action or worker may already have handled it.
            if (updated.count !== 1) return false

            await tx.transportRequestEvent.create({
              data: {
                transportRequestId: candidate.id,
                actorId: null,
                version: candidate.version + 1,
                action: 'TRANSPORT_REQUEST_EXPIRED',
                previousStatus: 'REQUESTED',
                newStatus: 'EXPIRED',
                reason: 'No provider response was recorded before the deadline.',
                details: {
                  responseDueAt: candidate.responseDueAt.toISOString(),
                  processedAt: now.toISOString(),
                },
              },
            })

            return true
          })

          if (expired) expiredCount += 1
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            ['P2002', 'P2034'].includes(error.code)
          ) {
            // Recheck on a later cycle after a concurrent change.
            continue
          }

          throw error
        }
      }

      if (expiredCount > 0) {
        console.log(`Transport expiry: ${expiredCount} request(s) expired.`)
      }
    } catch (error) {
      console.error('Transport expiry check failed:', {
        name: error instanceof Error ? error.name : 'UnknownError',
        code:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,
      })
    } finally {
      running = false
    }
  }

  // Catch up immediately after a backend restart.
  void expireRequests()

  const interval = setInterval(() => {
    void expireRequests()
  }, 30_000)

  interval.unref()

  return function stopTransportExpiryWorker() {
    stopped = true
    clearInterval(interval)
  }
}
import { Router } from 'express'
import { prisma } from './db.js'
import type {} from './auth.js'
import {
  AppointmentStatus,
  Prisma,
} from './generated/prisma/client.js'
import { checkAppointmentAvailability } from './availability-check.js'
import { expirePendingRequests } from './appointment-expiry.js'

export const providerAppointmentsRouter = Router()

providerAppointmentsRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const userId = req.session.userId

    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ message: 'Please sign in again.' })
      return
    }

    if (user.role !== 'VET') {
      res.status(403).json({
        message: 'A vet account is required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// GET /api/provider/appointments?page=1
providerAppointmentsRouter.get('/', async (req, res, next) => {
  const page = req.query.page
  const appointmentId = req.query.appointmentId

if (
  appointmentId !== undefined &&
  (
    typeof appointmentId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)
  )
) {
  res.status(400).json({
    message: 'Invalid appointment ID.',
  })
  return
}
  
  const status = req.query.status ?? 'REQUESTED'

if (
  typeof status !== 'string' ||
  (
    status !== 'ALL' &&
    !Object.values(AppointmentStatus).includes(
      status as AppointmentStatus,
    )
  )
) {
  res.status(400).json({
    message: 'Choose a valid appointment status.',
  })
  return
}
  if (
    page !== undefined &&
    (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page))
  ) {
    res.status(400).json({
      message: 'Page must be a positive number up to 99999.',
    })
    return
  }

  const providerUserId = req.session.userId

  if (!providerUserId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const pageNumber = page === undefined ? 1 : Number(page)
  const pageSize = 12

  try {
    await expirePendingRequests({ providerUserId })
  
    const where: Prisma.AppointmentWhereInput = {
      providerUserId,
      ...(typeof appointmentId === 'string'
        ? { id: appointmentId }
        : status === 'ALL'
          ? {}
          : { status: status as AppointmentStatus }),
    }

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        orderBy: [
          { requestedStartAt: 'asc' },
          { id: 'asc' },
        ],
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          reasonCategory: true,
          reasonDetails: true,
          contactPreference: true,
          contactEmail: true,
          contactPhone: true,
          requestedStartAt: true,
          requestedEndAt: true,
          confirmedStartAt: true,
          confirmedEndAt: true,
          proposedStartAt: true,
          proposedEndAt: true,
          timeZone: true,
          isDemo: true,
          version: true,
          createdAt: true,
          events: {
            orderBy: { version: 'desc' },
            take: 20,
            select: {
              id: true,
              action: true,
              previousStatus: true,
              newStatus: true,
              reason: true,
              createdAt: true,
            },
          },
          owner: {
            select: { name: true },
          },
          pet: {
            select: {
              name: true,
              species: true,
              breedOrType: true,
              ageGroup: true,
            },
          },
          listing: {
            select: {
              clinicName: true,
            },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ])

    res.json({
      appointments,
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    next(error)
  }
})
class ProviderAppointmentError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

providerAppointmentsRouter.post(
  '/:id/decline',
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({
        message: 'Send the request as JSON.',
      })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({
        message: 'Invalid appointment ID.',
      })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['version', 'reason'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      typeof input.reason !== 'string' ||
      input.reason.length > 1000 ||
      input.reason.trim().length < 5
    ) {
      res.status(400).json({
        message:
          'Provide the current version and a reason of 5–1000 characters.',
      })
      return
    }

    const providerUserId = req.session.userId

    if (!providerUserId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number
    const reason = input.reason.trim() as string

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        const provider = await tx.user.findUnique({
          where: { id: providerUserId },
          select: { role: true, status: true },
        })

        if (
          !provider ||
          provider.role !== 'VET' ||
          provider.status !== 'ACTIVE'
        ) {
          throw new ProviderAppointmentError(
            403,
            'An active vet account is required.',
          )
        }

        const current = await tx.appointment.findFirst({
          where: { id, providerUserId },
          select: {
            id: true,
            ownerId: true,
            status: true,
            version: true,
          },
        })

        if (!current) {
          throw new ProviderAppointmentError(
            404,
            'Appointment not found.',
          )
        }

        // Recognize a retry if this exact decline already succeeded.
        if (
          current.status === 'DECLINED' &&
          current.version === version + 1
        ) {
          const savedEvent = await tx.appointmentEvent.findUnique({
            where: {
              appointmentId_version: {
                appointmentId: id,
                version: version + 1,
              },
            },
            select: {
              actorId: true,
              action: true,
              reason: true,
            },
          })

          if (
            savedEvent?.actorId === providerUserId &&
            savedEvent.action === 'APPOINTMENT_DECLINED' &&
            savedEvent.reason === reason
          ) {
            return current
          }
        }

        if (
          current.status !== 'REQUESTED' ||
          current.version !== version
        ) {
          throw new ProviderAppointmentError(
            409,
            'This appointment has changed. Refresh the queue.',
          )
        }

        // The version check prevents overwriting another response.
        const updated = await tx.appointment.updateMany({
          where: {
            id,
            providerUserId,
            status: 'REQUESTED',
            version,
          },
          data: {
            status: 'DECLINED',
            declinedAt: new Date(),
            responseDueAt: null,
            version: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new ProviderAppointmentError(
            409,
            'This appointment has changed. Refresh the queue.',
          )
        }

        await tx.appointmentEvent.create({
          data: {
            appointmentId: id,
            actorId: providerUserId,
            version: version + 1,
            action: 'APPOINTMENT_DECLINED',
            notifications: {
              create: {
                userId: current.ownerId,
              },
            },
            previousStatus: 'REQUESTED',
            newStatus: 'DECLINED',
            reason,
          },
        })

        return {
          id,
          status: 'DECLINED' as const,
          version: version + 1,
        }
      })

      res.json({
        message: 'Request declined. No automatic notification was sent.',
        appointment,
      })
    } catch (error) {
      if (error instanceof ProviderAppointmentError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        res.status(409).json({
          message: 'This appointment has changed. Refresh the queue.',
        })
        return
      }

      next(error)
    }
  },
)
providerAppointmentsRouter.post(
  '/:id/accept',
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({
        message: 'Send the request as JSON.',
      })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({
        message: 'Invalid appointment ID.',
      })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'version') ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647
    ) {
      res.status(400).json({
        message: 'Provide the current appointment version.',
      })
      return
    }

    const providerUserId = req.session.userId

    if (!providerUserId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const appointment = await prisma.$transaction(
            async (tx) => {
              const provider = await tx.user.findUnique({
                where: { id: providerUserId },
                select: { role: true, status: true },
              })

              if (
                !provider ||
                provider.role !== 'VET' ||
                provider.status !== 'ACTIVE'
              ) {
                throw new ProviderAppointmentError(
                  403,
                  'An active vet account is required.',
                )
              }

              const current = await tx.appointment.findFirst({
                where: { id, providerUserId },
                include: {
                  listing: true,
                  owner: {
                    select: { role: true, status: true },
                  },
                  pet: {
                    select: { ownerId: true, species: true },
                  },
                },
              })

              if (!current) {
                throw new ProviderAppointmentError(
                  404,
                  'Appointment not found.',
                )
              }

              // Return the existing confirmation after an identical retry.
              if (
                current.status === 'CONFIRMED' &&
                current.version === version + 1
              ) {
                const event = await tx.appointmentEvent.findUnique({
                  where: {
                    appointmentId_version: {
                      appointmentId: id,
                      version: version + 1,
                    },
                  },
                  select: {
                    actorId: true,
                    action: true,
                  },
                })

                if (
                  event?.actorId === providerUserId &&
                  event.action === 'APPOINTMENT_CONFIRMED'
                ) {
                  return {
                    id: current.id,
                    status: current.status,
                    version: current.version,
                    confirmedStartAt: current.confirmedStartAt,
                    confirmedEndAt: current.confirmedEndAt,
                    timeZone: current.timeZone,
                    isDemo: current.isDemo,
                  }
                }
              }

              if (
                current.status !== 'REQUESTED' ||
                current.version !== version
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'This appointment has changed. Refresh the queue.',
                )
              }

              const now = new Date()
              const listing = current.listing

              if (
                current.requestedStartAt <= now ||
                current.requestedEndAt <= current.requestedStartAt ||
                (
                  current.responseDueAt !== null &&
                  current.responseDueAt <= now
                )
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'The requested time or response deadline has passed.',
                )
              }

              if (
                listing.userId !== providerUserId ||
                listing.status !== 'PUBLISHED' ||
                !listing.publishedAt ||
                listing.publishedAt > now ||
                !listing.bookingEnabled ||
                listing.verificationStatus === 'SUSPENDED' ||
                listing.isDemo !== current.isDemo
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'This clinic is not currently eligible to confirm requests.',
                )
              }

              if (
                !listing.isDemo &&
                (
                  listing.verificationStatus !== 'APPROVED' ||
                  !listing.verificationReviewedAt ||
                  listing.verificationReviewedAt > now ||
                  !listing.verificationReviewedById ||
                  !listing.verificationEvidenceReferences?.trim()
                )
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'This clinic must have approved verification before confirming requests.',
                )
              }

              if (
                current.owner.role !== 'OWNER' ||
                current.owner.status !== 'ACTIVE' ||
                current.pet.ownerId !== current.ownerId ||
                !listing.species.includes(current.pet.species)
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'The owner or pet is no longer eligible for this appointment.',
                )
              }
              const availabilityError = await checkAppointmentAvailability(
                tx,
                current.vetListingId,
                current.requestedStartAt,
                current.requestedEndAt,
              )
              
              if (availabilityError) {
                throw new ProviderAppointmentError(409, availabilityError)
              }

              // Back-to-back appointments are allowed.
              // Any actual overlap with a reserved interval is blocked.
              
              const overlap = await tx.appointment.findFirst({
                where: {
                  id: { not: current.id },
                  status: {
                    in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
                  },
                  confirmedStartAt: {
                    lt: current.requestedEndAt,
                  },
                  confirmedEndAt: {
                    gt: current.requestedStartAt,
                  },
                  OR: [
                    { providerUserId },
                    { vetListingId: current.vetListingId },
                    { petId: current.petId },
                  ],
                },
                select: { id: true },
              })

              if (overlap) {
                throw new ProviderAppointmentError(
                  409,
                  'This time overlaps a confirmed appointment for the vet, clinic, or pet.',
                )
              }

              const updated = await tx.appointment.updateMany({
                where: {
                  id,
                  providerUserId,
                  status: 'REQUESTED',
                  version,
                },
                data: {
                  status: 'CONFIRMED',
                  confirmedStartAt: current.requestedStartAt,
                  confirmedEndAt: current.requestedEndAt,
                  confirmedAt: now,
                  proposedStartAt: null,
                  proposedEndAt: null,
                  responseDueAt: null,
                  version: { increment: 1 },
                },
              })

              if (updated.count !== 1) {
                throw new ProviderAppointmentError(
                  409,
                  'This appointment has changed. Refresh the queue.',
                )
              }

              await tx.appointmentEvent.create({
                data: {
                  appointmentId: id,
                  actorId: providerUserId,
                  version: version + 1,
                  action: 'APPOINTMENT_CONFIRMED',
                  notifications: {
                    create: {
                      userId: current.ownerId,
                    },
                  },
                  previousStatus: 'REQUESTED',
                  newStatus: 'CONFIRMED',
                  details: {
                    confirmedStartAt:
                      current.requestedStartAt.toISOString(),
                    confirmedEndAt:
                      current.requestedEndAt.toISOString(),
                    timeZone: current.timeZone,
                    isDemo: current.isDemo,
                  },
                },
              })

              return {
                id,
                status: 'CONFIRMED' as const,
                version: version + 1,
                confirmedStartAt: current.requestedStartAt,
                confirmedEndAt: current.requestedEndAt,
                timeZone: current.timeZone,
                isDemo: current.isDemo,
              }
            },
            {
              isolationLevel:
                Prisma.TransactionIsolationLevel.Serializable,
            },
          )

          res.json({
            message: appointment.isDemo
              ? 'Demo request confirmed. No real appointment has been arranged.'
              : 'Appointment confirmed. No automatic notification was sent.',
            appointment,
          })
          return
        } catch (error) {
          const retryable =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (
              error.code === 'P2034' ||
              error.code === 'P2002'
            )

          if (retryable && attempt < 2) {
            continue
          }

          if (retryable) {
            throw new ProviderAppointmentError(
              409,
              'Another appointment changed at the same time. Refresh the queue and try again.',
            )
          }

          throw error
        }
      }
    } catch (error) {
      if (error instanceof ProviderAppointmentError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)
providerAppointmentsRouter.post(
  '/:id/complete',
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({
        message: 'Send the request as JSON.',
      })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({
        message: 'Invalid appointment ID.',
      })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'version') ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647
    ) {
      res.status(400).json({
        message: 'Provide the current appointment version.',
      })
      return
    }

    const providerUserId = req.session.userId

    if (!providerUserId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        const provider = await tx.user.findUnique({
          where: { id: providerUserId },
          select: { role: true, status: true },
        })

        if (
          !provider ||
          provider.role !== 'VET' ||
          provider.status !== 'ACTIVE'
        ) {
          throw new ProviderAppointmentError(
            403,
            'An active vet account is required.',
          )
        }

        const current = await tx.appointment.findFirst({
          where: { id, providerUserId },
          select: {
            id: true,
            ownerId: true,
            status: true,
            version: true,
            confirmedEndAt: true,
          },
        })

        if (!current) {
          throw new ProviderAppointmentError(
            404,
            'Appointment not found.',
          )
        }

        // Recognize a retry after this exact action succeeded.
        if (
          current.status === 'COMPLETED' &&
          current.version === version + 1
        ) {
          const event = await tx.appointmentEvent.findUnique({
            where: {
              appointmentId_version: {
                appointmentId: id,
                version: version + 1,
              },
            },
            select: {
              actorId: true,
              action: true,
            },
          })

          if (
            event?.actorId === providerUserId &&
            event.action === 'APPOINTMENT_COMPLETED'
          ) {
            return {
              id,
              status: current.status,
              version: current.version,
            }
          }
        }

        if (
          current.status !== 'CONFIRMED' ||
          current.version !== version
        ) {
          throw new ProviderAppointmentError(
            409,
            'This appointment has changed or is not confirmed. Refresh the list.',
          )
        }

        const now = new Date()

        if (
          !current.confirmedEndAt ||
          current.confirmedEndAt > now
        ) {
          throw new ProviderAppointmentError(
            409,
            'An appointment can only be completed after its scheduled end time.',
          )
        }

        const updated = await tx.appointment.updateMany({
          where: {
            id,
            providerUserId,
            status: 'CONFIRMED',
            version,
          },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            version: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new ProviderAppointmentError(
            409,
            'This appointment changed. Refresh and check its status.',
          )
        }

        await tx.appointmentEvent.create({
          data: {
            appointmentId: id,
            actorId: providerUserId,
            version: version + 1,
            action: 'APPOINTMENT_COMPLETED',
            notifications: {
              create: {
                userId: current.ownerId,
              },
            },
            previousStatus: 'CONFIRMED',
            newStatus: 'COMPLETED',
          },
        })

        return {
          id,
          status: 'COMPLETED' as const,
          version: version + 1,
        }
      })

      res.json({
        message: 'Appointment marked completed.',
        appointment,
      })
    } catch (error) {
      if (error instanceof ProviderAppointmentError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        res.status(409).json({
          message: 'This appointment has changed. Refresh the list.',
        })
        return
      }

      next(error)
    }
  },
)
providerAppointmentsRouter.post(
  '/:id/propose-reschedule',
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({
        message: 'Send the request as JSON.',
      })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({
        message: 'Invalid appointment ID.',
      })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) =>
          !['version', 'proposedStartAt', 'reason'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      typeof input.reason !== 'string' ||
      input.reason.length > 1000 ||
      input.reason.trim().length < 5
    ) {
      res.status(400).json({
        message:
          'Provide the current version, a new time, and a reason of 5–1000 characters.',
      })
      return
    }

    // The frontend will send UTC using Date.toISOString().
    if (
      typeof input.proposedStartAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(
        input.proposedStartAt,
      )
    ) {
      res.status(400).json({
        message: 'Provide the proposed time in UTC with zero seconds.',
      })
      return
    }

    const proposedStartAt = new Date(input.proposedStartAt)

    if (
      !Number.isFinite(proposedStartAt.getTime()) ||
      proposedStartAt.toISOString() !== input.proposedStartAt
    ) {
      res.status(400).json({
        message: 'Enter a valid proposed date and time.',
      })
      return
    }

    const proposedEndAt = new Date(
      proposedStartAt.getTime() + 30 * 60 * 1000,
    )

    const providerUserId = req.session.userId

    if (!providerUserId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number
    const reason = input.reason.trim() as string

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const appointment = await prisma.$transaction(
            async (tx) => {
              const provider = await tx.user.findUnique({
                where: { id: providerUserId },
                select: { role: true, status: true },
              })

              if (
                !provider ||
                provider.role !== 'VET' ||
                provider.status !== 'ACTIVE'
              ) {
                throw new ProviderAppointmentError(
                  403,
                  'An active vet account is required.',
                )
              }

              const current = await tx.appointment.findFirst({
                where: { id, providerUserId },
                include: {
                  listing: true,
                  owner: {
                    select: { role: true, status: true },
                  },
                  pet: {
                    select: { ownerId: true, species: true },
                  },
                },
              })

              if (!current) {
                throw new ProviderAppointmentError(
                  404,
                  'Appointment not found.',
                )
              }

              // Recognize an identical retry.
              if (
                current.status === 'RESCHEDULE_PROPOSED' &&
                current.version === version + 1 &&
                current.proposedStartAt?.getTime() ===
                  proposedStartAt.getTime() &&
                current.proposedEndAt?.getTime() ===
                  proposedEndAt.getTime()
              ) {
                const event = await tx.appointmentEvent.findUnique({
                  where: {
                    appointmentId_version: {
                      appointmentId: id,
                      version: version + 1,
                    },
                  },
                  select: {
                    actorId: true,
                    action: true,
                    reason: true,
                  },
                })

                if (
                  event?.actorId === providerUserId &&
                  event.action === 'APPOINTMENT_RESCHEDULE_PROPOSED' &&
                  event.reason === reason
                ) {
                  return {
                    id,
                    status: current.status,
                    version: current.version,
                    proposedStartAt: current.proposedStartAt,
                    proposedEndAt: current.proposedEndAt,
                    timeZone: current.timeZone,
                    isDemo: current.isDemo,
                  }
                }
              }

              if (
                current.status !== 'CONFIRMED' ||
                current.version !== version
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'Only a current confirmed appointment can be rescheduled. Refresh the list.',
                )
              }

              const now = new Date()

              if (
                !current.confirmedStartAt ||
                !current.confirmedEndAt ||
                current.confirmedStartAt <= now
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'Rescheduling must be proposed before the confirmed appointment starts.',
                )
              }

              if (
                proposedStartAt <= now ||
                proposedStartAt.getTime() >
                  now.getTime() + 90 * 24 * 60 * 60 * 1000
              ) {
                throw new ProviderAppointmentError(
                  400,
                  'Choose a future time within the next 90 days.',
                )
              }

              if (
                proposedStartAt.getTime() ===
                current.confirmedStartAt.getTime()
              ) {
                throw new ProviderAppointmentError(
                  400,
                  'Choose a time different from the confirmed time.',
                )
              }

              const listing = current.listing

              if (
                listing.userId !== providerUserId ||
                listing.status !== 'PUBLISHED' ||
                !listing.publishedAt ||
                listing.publishedAt > now ||
                !listing.bookingEnabled ||
                listing.verificationStatus === 'SUSPENDED' ||
                listing.isDemo !== current.isDemo
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'This clinic is not currently eligible to propose a new time.',
                )
              }

              if (
                !listing.isDemo &&
                (
                  listing.verificationStatus !== 'APPROVED' ||
                  !listing.verificationReviewedAt ||
                  listing.verificationReviewedAt > now ||
                  !listing.verificationReviewedById ||
                  !listing.verificationEvidenceReferences?.trim()
                )
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'Approved clinic verification is required.',
                )
              }

              if (
                current.owner.role !== 'OWNER' ||
                current.owner.status !== 'ACTIVE' ||
                current.pet.ownerId !== current.ownerId ||
                !listing.species.includes(current.pet.species)
              ) {
                throw new ProviderAppointmentError(
                  409,
                  'The owner or pet is no longer eligible.',
                )
              }

              const availabilityError = await checkAppointmentAvailability(
                tx,
                current.vetListingId,
                proposedStartAt,
                proposedEndAt,
              )
              
              if (availabilityError) {
                throw new ProviderAppointmentError(409, availabilityError)
              }

              const overlap = await tx.appointment.findFirst({
                where: {
                  id: { not: id },
                  status: {
                    in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
                  },
                  confirmedStartAt: { lt: proposedEndAt },
                  confirmedEndAt: { gt: proposedStartAt },
                  OR: [
                    { providerUserId },
                    { vetListingId: current.vetListingId },
                    { petId: current.petId },
                  ],
                },
                select: { id: true },
              })

              if (overlap) {
                throw new ProviderAppointmentError(
                  409,
                  'The proposed time overlaps a confirmed appointment for the vet, clinic, or pet.',
                )
              }

              const updated = await tx.appointment.updateMany({
                where: {
                  id,
                  providerUserId,
                  status: 'CONFIRMED',
                  version,
                },
                data: {
                  status: 'RESCHEDULE_PROPOSED',
                  proposedStartAt,
                  proposedEndAt,
                  version: { increment: 1 },
                },
              })

              if (updated.count !== 1) {
                throw new ProviderAppointmentError(
                  409,
                  'This appointment changed. Refresh the list.',
                )
              }

              await tx.appointmentEvent.create({
                data: {
                  appointmentId: id,
                  actorId: providerUserId,
                  version: version + 1,
                  action: 'APPOINTMENT_RESCHEDULE_PROPOSED',
                  notifications: {
                    create: {
                      userId: current.ownerId,
                    },
                  },
                  previousStatus: 'CONFIRMED',
                  newStatus: 'RESCHEDULE_PROPOSED',
                  reason,
                  details: {
                    confirmedStartAt:
                      current.confirmedStartAt.toISOString(),
                    confirmedEndAt:
                      current.confirmedEndAt.toISOString(),
                    proposedStartAt: proposedStartAt.toISOString(),
                    proposedEndAt: proposedEndAt.toISOString(),
                    timeZone: current.timeZone,
                    isDemo: current.isDemo,
                  },
                },
              })

              return {
                id,
                status: 'RESCHEDULE_PROPOSED' as const,
                version: version + 1,
                proposedStartAt,
                proposedEndAt,
                timeZone: current.timeZone,
                isDemo: current.isDemo,
              }
            },
            {
              isolationLevel:
                Prisma.TransactionIsolationLevel.Serializable,
            },
          )

          res.json({
            message:
              'New time proposed. The original slot remains reserved until the owner accepts. No automatic notification was sent.',
            appointment,
          })
          return
        } catch (error) {
          const retryable =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (
              error.code === 'P2034' ||
              error.code === 'P2002'
            )

          if (retryable && attempt < 2) {
            continue
          }

          if (retryable) {
            throw new ProviderAppointmentError(
              409,
              'Another appointment changed at the same time. Refresh and try again.',
            )
          }

          throw error
        }
      }
    } catch (error) {
      if (error instanceof ProviderAppointmentError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)
providerAppointmentsRouter.post(
  '/:id/cancel',
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({ message: 'Send the request as JSON.' })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({ message: 'Invalid appointment ID.' })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['version', 'reason'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      typeof input.reason !== 'string' ||
      input.reason.length > 1000 ||
      input.reason.trim().length < 5
    ) {
      res.status(400).json({
        message: 'Provide the current version and a reason of 5–1000 characters.',
      })
      return
    }

    const providerUserId = req.session.userId

    if (!providerUserId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number
    const reason = input.reason.trim() as string

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        const provider = await tx.user.findUnique({
          where: { id: providerUserId },
          select: { role: true, status: true },
        })

        if (
          !provider ||
          provider.role !== 'VET' ||
          provider.status !== 'ACTIVE'
        ) {
          throw new ProviderAppointmentError(
            403,
            'An active vet account is required.',
          )
        }

        const current = await tx.appointment.findFirst({
          where: { id, providerUserId },
          select: {
            id: true,
            ownerId: true,
            status: true,
            version: true,
            confirmedStartAt: true,
          },
        })

        if (!current) {
          throw new ProviderAppointmentError(
            404,
            'Appointment not found.',
          )
        }

        // Recognize an identical retry after successful cancellation.
        if (
          current.status === 'CANCELLED' &&
          current.version === version + 1
        ) {
          const event = await tx.appointmentEvent.findUnique({
            where: {
              appointmentId_version: {
                appointmentId: id,
                version: version + 1,
              },
            },
            select: {
              actorId: true,
              action: true,
              reason: true,
            },
          })

          if (
            event?.actorId === providerUserId &&
            event.action === 'APPOINTMENT_CANCELLED_BY_PROVIDER' &&
            event.reason === reason
          ) {
            return { id, status: current.status, version: current.version }
          }
        }

        if (
          current.version !== version ||
          (
            current.status !== 'CONFIRMED' &&
            current.status !== 'RESCHEDULE_PROPOSED'
          )
        ) {
          throw new ProviderAppointmentError(
            409,
            'This appointment changed or cannot be cancelled. Refresh the list.',
          )
        }

        const now = new Date()

        if (
          !current.confirmedStartAt ||
          current.confirmedStartAt <= now
        ) {
          throw new ProviderAppointmentError(
            409,
            'This action is only available before the original confirmed start time.',
          )
        }

        const updated = await tx.appointment.updateMany({
          where: {
            id,
            providerUserId,
            version,
            status: current.status,
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            proposedStartAt: null,
            proposedEndAt: null,
            responseDueAt: null,
            version: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new ProviderAppointmentError(
            409,
            'This appointment changed. Refresh and check its status.',
          )
        }

        await tx.appointmentEvent.create({
          data: {
            appointmentId: id,
            actorId: providerUserId,
            version: version + 1,
            action: 'APPOINTMENT_CANCELLED_BY_PROVIDER',
            previousStatus: current.status,
            newStatus: 'CANCELLED',
            reason,
            notifications: {
              create: { userId: current.ownerId },
            },
          },
        })

        return {
          id,
          status: 'CANCELLED' as const,
          version: version + 1,
        }
      })

      res.json({
        message: 'Appointment cancelled. An in-app notification was created for the owner.',
        appointment,
      })
    } catch (error) {
      if (error instanceof ProviderAppointmentError) {
        res.status(error.statusCode).json({ message: error.message })
        return
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        res.status(409).json({
          message: 'This appointment changed. Refresh and check its status.',
        })
        return
      }

      next(error)
    }
  },
)
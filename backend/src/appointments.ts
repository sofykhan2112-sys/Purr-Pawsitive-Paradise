import { expirePendingRequests } from './appointment-expiry.js'
import { Router } from 'express'
import { prisma } from './db.js'
import type {} from './auth.js'
import { createHash } from 'node:crypto'
import {
  AppointmentReason,
  AppointmentContactPreference,
  AppointmentStatus,
  Prisma,
} from './generated/prisma/client.js'
import { rateLimit } from 'express-rate-limit'
import { checkAppointmentAvailability } from './availability-check.js'

export const appointmentsRouter = Router()

// Every route requires an active owner account.
appointmentsRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const userId = req.session.userId

    if (!userId) {
      res.status(401).json({
        message: 'Please sign in.',
      })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        message: 'Please sign in again.',
      })
      return
    }

    if (user.role !== 'OWNER') {
      res.status(403).json({
        message: 'An owner account is required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// GET /api/appointments?page=1
// Ownership comes from the session, never from query parameters.
appointmentsRouter.get('/', async (req, res, next) => {
  const page = req.query.page
  const status = req.query.status ?? 'ALL'

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

  if (
    page !== undefined &&
    (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page))
  ) {
    res.status(400).json({
      message: 'Page must be a positive number up to 99999.',
    })
    return
  }

  const ownerId = req.session.userId

  if (!ownerId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  const pageNumber = page === undefined ? 1 : Number(page)
  const pageSize = 12

  try {
    await expirePendingRequests({ ownerId })
    const where: Prisma.AppointmentWhereInput = {
      ownerId,
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
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          reasonCategory: true,
          requestedStartAt: true,
          requestedEndAt: true,
          confirmedStartAt: true,
          confirmedEndAt: true,
          proposedStartAt: true,
          proposedEndAt: true,
          timeZone: true,
          isDemo: true,
          responseDueAt: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          events: {
            orderBy: { version: 'desc' },
            take: 20,
            select: {
              id: true,
              version: true,
              action: true,
              previousStatus: true,
              newStatus: true,
              reason: true,
              createdAt: true,
            },
          },
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
            },
          },
          listing: {
            select: {
              id: true,
              clinicName: true,
              vetName: true,
              city: true,
              state: true,
            },
          },
        },
      }),
      prisma.appointment.count({
        where: {
          ownerId,
        },
      }),
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
class AppointmentRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

const appointmentRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many appointment attempts. Please try again later.',
  },
})

function validAppointmentUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

const appointmentReceiptSelect = {
  id: true,
  status: true,
  requestedStartAt: true,
  requestedEndAt: true,
  timeZone: true,
  isDemo: true,
  version: true,
  createdAt: true,
} satisfies Prisma.AppointmentSelect

// POST /api/appointments
// The existing router middleware requires an active OWNER account.
appointmentsRouter.post(
  '/',
  appointmentRequestLimiter,
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

    const input = req.body

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      res.status(400).json({
        message: 'Provide the appointment details as JSON.',
      })
      return
    }

    const allowedFields = [
      'petId',
      'vetListingId',
      'requestedStartAt',
      'reasonCategory',
      'reasonDetails',
      'contactPreference',
      'contactEmail',
      'contactPhone',
      'idempotencyKey',
      'demoAcknowledged',
    ]

    if (
      Object.keys(input).some(
        (key) => !allowedFields.includes(key),
      )
    ) {
      res.status(400).json({
        message: 'The request contains unsupported fields.',
      })
      return
    }

    if (
      !validAppointmentUuid(input.petId) ||
      !validAppointmentUuid(input.vetListingId)
    ) {
      res.status(400).json({
        message: 'Choose a valid pet and vet listing.',
      })
      return
    }

    if (
      typeof input.idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotencyKey)
    ) {
      res.status(400).json({
        message: 'Provide a valid request key.',
      })
      return
    }

    if (
      typeof input.reasonCategory !== 'string' ||
      !Object.values(AppointmentReason).includes(
        input.reasonCategory as AppointmentReason,
      )
    ) {
      res.status(400).json({
        message: 'Choose a valid appointment reason.',
      })
      return
    }

    if (
      typeof input.contactPreference !== 'string' ||
      !Object.values(AppointmentContactPreference).includes(
        input.contactPreference as AppointmentContactPreference,
      )
    ) {
      res.status(400).json({
        message: 'Choose EMAIL or PHONE as your contact preference.',
      })
      return
    }

    for (const field of [
      { key: 'reasonDetails', max: 1000 },
      { key: 'contactEmail', max: 254 },
      { key: 'contactPhone', max: 30 },
    ]) {
      const value = input[field.key]

      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== 'string' || value.length > field.max)
      ) {
        res.status(400).json({
          message: `${field.key} must be text up to ${field.max} characters.`,
        })
        return
      }
    }

    if (
      input.demoAcknowledged !== undefined &&
      typeof input.demoAcknowledged !== 'boolean'
    ) {
      res.status(400).json({
        message: 'Demo confirmation must be true or false.',
      })
      return
    }

    // Require an explicit offset so server-local time is never assumed.
    if (
      typeof input.requestedStartAt !== 'string' ||
      input.requestedStartAt.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        input.requestedStartAt,
      )
    ) {
      res.status(400).json({
        message:
          'Provide the requested time with a time-zone offset and zero seconds.',
      })
      return
    }

    const requestedStartAt = new Date(input.requestedStartAt)

    if (Number.isNaN(requestedStartAt.getTime())) {
      res.status(400).json({
        message: 'Enter a valid appointment date and time.',
      })
      return
    }

    const requestedEndAt = new Date(
      requestedStartAt.getTime() + 30 * 60 * 1000,
    )

    const reasonCategory =
      input.reasonCategory as AppointmentReason

    const contactPreference =
      input.contactPreference as AppointmentContactPreference

    const reasonDetails =
      typeof input.reasonDetails === 'string'
        ? input.reasonDetails.trim() || null
        : null

    const contactEmail =
      typeof input.contactEmail === 'string'
        ? input.contactEmail.trim().toLowerCase() || null
        : null

    const contactPhone =
      typeof input.contactPhone === 'string'
        ? input.contactPhone.replace(/[\s().-]/g, '') || null
        : null

    if (
      contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ) {
      res.status(400).json({
        message: 'Enter a valid contact email.',
      })
      return
    }

    if (contactPhone && !/^\+?\d{7,15}$/.test(contactPhone)) {
      res.status(400).json({
        message: 'Enter a contact phone number with 7–15 digits.',
      })
      return
    }

    if (
      (contactPreference === 'EMAIL' && !contactEmail) ||
      (contactPreference === 'PHONE' && !contactPhone)
    ) {
      res.status(400).json({
        message: 'Provide details for your selected contact method.',
      })
      return
    }

    if (reasonCategory === 'OTHER' && !reasonDetails) {
      res.status(400).json({
        message: 'Briefly describe the reason for the appointment.',
      })
      return
    }

    const ownerId = req.session.userId

    if (!ownerId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const petId = input.petId as string
    const vetListingId = input.vetListingId as string
    const idempotencyKey = input.idempotencyKey as string
    const demoAcknowledged = input.demoAcknowledged === true

    const requestFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          petId,
          vetListingId,
          requestedStartAt: requestedStartAt.toISOString(),
          reasonCategory,
          reasonDetails,
          contactPreference,
          contactEmail,
          contactPhone,
          demoAcknowledged,
        }),
      )
      .digest('hex')

    try {
      // Retry a short transaction if another request changes the same data.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await prisma.$transaction(
            async (tx) => {
              const owner = await tx.user.findUnique({
                where: { id: ownerId },
                select: {
                  role: true,
                  status: true,
                },
              })

              if (
                !owner ||
                owner.role !== 'OWNER' ||
                owner.status !== 'ACTIVE'
              ) {
                throw new AppointmentRequestError(
                  403,
                  'An active owner account is required.',
                )
              }

              const previous = await tx.appointment.findUnique({
                where: {
                  ownerId_idempotencyKey: {
                    ownerId,
                    idempotencyKey,
                  },
                },
                select: {
                  ...appointmentReceiptSelect,
                  requestFingerprint: true,
                },
              })

              if (previous) {
                if (previous.requestFingerprint !== requestFingerprint) {
                  throw new AppointmentRequestError(
                    409,
                    'This request key was already used for different details.',
                  )
                }

                const {
                  requestFingerprint: savedFingerprint,
                  ...appointment
                } = previous

                void savedFingerprint

                return { appointment, replayed: true }
              }

              const now = new Date()
              const latestAllowed = new Date(
                now.getTime() + 90 * 24 * 60 * 60 * 1000,
              )

              if (
                requestedStartAt <= now ||
                requestedStartAt > latestAllowed
              ) {
                throw new AppointmentRequestError(
                  400,
                  'Choose a future appointment within the next 90 days.',
                )
              }

              const pet = await tx.pet.findFirst({
                where: {
                  id: petId,
                  ownerId,
                },
                select: {
                  id: true,
                  species: true,
                },
              })

              if (!pet) {
                throw new AppointmentRequestError(
                  404,
                  'Pet profile not found.',
                )
              }

              const listing = await tx.vetListing.findUnique({
                where: { id: vetListingId },
                include: {
                  user: {
                    select: {
                      id: true,
                      role: true,
                      status: true,
                    },
                  },
                },
              })

              if (
                !listing ||
                listing.status !== 'PUBLISHED' ||
                !listing.publishedAt ||
                listing.publishedAt > now ||
                !listing.bookingEnabled ||
                listing.verificationStatus === 'SUSPENDED' ||
                !listing.user ||
                listing.user.role !== 'VET' ||
                listing.user.status !== 'ACTIVE'
              ) {
                throw new AppointmentRequestError(
                  409,
                  'This provider is not currently accepting requests.',
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
                throw new AppointmentRequestError(
                  409,
                  'This provider is not currently eligible for bookings.',
                )
              }

              if (!listing.species.includes(pet.species)) {
                throw new AppointmentRequestError(
                  400,
                  'This provider does not list support for your pet’s species.',
                )
              }

              if (listing.isDemo && !demoAcknowledged) {
                throw new AppointmentRequestError(
                  400,
                  'Confirm that this is a demo request and does not arrange real care.',
                )
              }
              const availabilityError = await checkAppointmentAvailability(
                tx,
                vetListingId,
                requestedStartAt,
                requestedEndAt,
              )
              
              if (availabilityError) {
                throw new AppointmentRequestError(409, availabilityError)
              }

              // Also block an identical active request using a new key.
              const duplicate = await tx.appointment.findFirst({
                where: {
                  ownerId,
                  petId,
                  vetListingId,
                  requestedStartAt,
                  status: {
                    in: [
                      'REQUESTED',
                      'CONFIRMED',
                      'RESCHEDULE_PROPOSED',
                    ],
                  },
                },
                select: { id: true },
              })

              if (duplicate) {
                throw new AppointmentRequestError(
                  409,
                  'You already have an active request for this pet, provider, and requested time. Check your appointments.',
                )
              }

              const appointment = await tx.appointment.create({
                data: {
                  ownerId,
                  petId,
                  vetListingId,
                  providerUserId: listing.user.id,
                  status: 'REQUESTED',
                  responseDueAt: new Date(
                    Math.min(
                      now.getTime() + 48 * 60 * 60 * 1000,
                      requestedStartAt.getTime(),
                    ),
                  ),
                  reasonCategory,
                  reasonDetails,
                  contactPreference,
                  contactEmail,
                  contactPhone,
                  requestedStartAt,
                  requestedEndAt,
                  timeZone: listing.timeZone,
                  isDemo: listing.isDemo,
                  idempotencyKey,
                  requestFingerprint,
                  version: 1,
                  events: {
                    create: {
                      actorId: ownerId,
                      version: 1,
                      action: 'APPOINTMENT_REQUESTED',
                      notifications: {
                        create: {
                          userId: listing.user.id,
                        },
                      },
                      previousStatus: null,
                      newStatus: 'REQUESTED',
                      details: {
                        requestedStartAt:
                          requestedStartAt.toISOString(),
                        requestedEndAt:
                          requestedEndAt.toISOString(),
                        timeZone: listing.timeZone,
                        isDemo: listing.isDemo,
                      },
                    },
                  },
                },
                select: appointmentReceiptSelect,
              })

              return { appointment, replayed: false }
            },
            {
              isolationLevel:
                Prisma.TransactionIsolationLevel.Serializable,
            },
          )

          res.status(result.replayed ? 200 : 201).json({
            message: result.replayed
              ? 'This request was already recorded. No duplicate was created.'
              : result.appointment.isDemo
                ? 'Demo request recorded. No real appointment has been arranged.'
                : 'Appointment requested. Wait for provider confirmation.',
            appointment: result.appointment,
            replayed: result.replayed,
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
            throw new AppointmentRequestError(
              409,
              'Another request was processed at the same time. Retry with the same request key.',
            )
          }

          throw error
        }
      }
    } catch (error) {
      if (error instanceof AppointmentRequestError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)
appointmentsRouter.post('/:id/cancel', async (req, res, next) => {
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
        'Provide the current version and a cancellation reason of 5–1000 characters.',
    })
    return
  }

  const ownerId = req.session.userId

  if (!ownerId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const version = input.version as number
  const reason = input.reason.trim() as string

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { id: ownerId },
        select: { role: true, status: true },
      })

      if (
        !owner ||
        owner.role !== 'OWNER' ||
        owner.status !== 'ACTIVE'
      ) {
        throw new AppointmentRequestError(
          403,
          'An active owner account is required.',
        )
      }

      const current = await tx.appointment.findFirst({
        where: { id, ownerId },
        select: {
          id: true,
          status: true,
          version: true,
          confirmedStartAt: true,
          providerUserId: true,
        },
      })

      if (!current) {
        throw new AppointmentRequestError(
          404,
          'Appointment not found.',
        )
      }

      // Recognize an identical retry after a successful cancellation.
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
          event?.actorId === ownerId &&
          event.action === 'APPOINTMENT_CANCELLED_BY_OWNER' &&
          event.reason === reason
        ) {
          return {
            id: current.id,
            status: current.status,
            version: current.version,
          }
        }
      }

      if (
        current.version !== version ||
        (
          current.status !== 'REQUESTED' &&
          current.status !== 'CONFIRMED' &&
          current.status !== 'RESCHEDULE_PROPOSED'
        )
      ) {
        throw new AppointmentRequestError(
          409,
          'This appointment has changed or cannot be cancelled. Refresh your appointments.',
        )
      }

      const now = new Date()

      if (
        (
          current.status === 'CONFIRMED' ||
          current.status === 'RESCHEDULE_PROPOSED'
        ) &&
        (
          !current.confirmedStartAt ||
          current.confirmedStartAt <= now
        )
      ) {
        throw new AppointmentRequestError(
          409,
          'A confirmed appointment cannot be cancelled here once its start time has passed. Contact the clinic.',
        )
      }

      const updated = await tx.appointment.updateMany({
        where: {
          id,
          ownerId,
          version,
          status: current.status,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          responseDueAt: null,
          proposedStartAt: null,
          proposedEndAt: null,
          version: { increment: 1 },
        },
      })

      if (updated.count !== 1) {
        throw new AppointmentRequestError(
          409,
          'This appointment changed while you were cancelling it. Refresh and check its status.',
        )
      }

      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          actorId: ownerId,
          version: version + 1,
          action: 'APPOINTMENT_CANCELLED_BY_OWNER',
          notifications: {
  create: {
    userId: current.providerUserId,
  },
},
          previousStatus: current.status,
          newStatus: 'CANCELLED',
          reason,
        },
      })

      return {
        id,
        status: 'CANCELLED' as const,
        version: version + 1,
      }
    })

    res.json({
      message:
        'Appointment cancelled. No automatic notification was sent.',
      appointment,
    })
  } catch (error) {
    if (error instanceof AppointmentRequestError) {
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
        message: 'This appointment has changed. Refresh and check its status.',
      })
      return
    }

    next(error)
  }
})
appointmentsRouter.post(
  '/:id/reschedule-response',
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
        (key) => !['version', 'decision'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      !['ACCEPT', 'REJECT'].includes(input.decision)
    ) {
      res.status(400).json({
        message: 'Provide the current version and ACCEPT or REJECT.',
      })
      return
    }

    const ownerId = req.session.userId

    if (!ownerId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const version = input.version as number
    const decision = input.decision as 'ACCEPT' | 'REJECT'

    const action =
      decision === 'ACCEPT'
        ? 'APPOINTMENT_RESCHEDULE_ACCEPTED'
        : 'APPOINTMENT_RESCHEDULE_REJECTED'

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const appointment = await prisma.$transaction(
            async (tx) => {
              const owner = await tx.user.findUnique({
                where: { id: ownerId },
                select: { role: true, status: true },
              })

              if (
                !owner ||
                owner.role !== 'OWNER' ||
                owner.status !== 'ACTIVE'
              ) {
                throw new AppointmentRequestError(
                  403,
                  'An active owner account is required.',
                )
              }

              const current = await tx.appointment.findFirst({
                where: { id, ownerId },
                include: {
                  listing: true,
                  provider: {
                    select: { role: true, status: true },
                  },
                  pet: {
                    select: { ownerId: true, species: true },
                  },
                },
              })

              if (!current) {
                throw new AppointmentRequestError(
                  404,
                  'Appointment not found.',
                )
              }

              // Recognize a retry after this exact response succeeded.
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
                  event?.actorId === ownerId &&
                  event.action === action
                ) {
                  return {
                    id,
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
                current.status !== 'RESCHEDULE_PROPOSED' ||
                current.version !== version
              ) {
                throw new AppointmentRequestError(
                  409,
                  'This proposal has changed or has already been answered. Refresh your appointments.',
                )
              }

              const originalStart = current.confirmedStartAt
              const originalEnd = current.confirmedEndAt
              const proposedStart = current.proposedStartAt
              const proposedEnd = current.proposedEndAt

              if (
                !originalStart ||
                !originalEnd ||
                !proposedStart ||
                !proposedEnd ||
                originalEnd <= originalStart ||
                proposedEnd <= proposedStart
              ) {
                throw new AppointmentRequestError(
                  409,
                  'This appointment has incomplete scheduling details. Contact the clinic.',
                )
              }

              const now = new Date()

              if (decision === 'ACCEPT') {
                if (
                  proposedStart <= now ||
                  proposedStart.getTime() >
                    now.getTime() + 90 * 24 * 60 * 60 * 1000
                ) {
                  throw new AppointmentRequestError(
                    409,
                    'The proposed time is no longer within the allowed booking window. You can reject this proposal.',
                  )
                }

                const listing = current.listing

                if (
                  current.provider.role !== 'VET' ||
                  current.provider.status !== 'ACTIVE' ||
                  listing.userId !== current.providerUserId ||
                  listing.status !== 'PUBLISHED' ||
                  !listing.publishedAt ||
                  listing.publishedAt > now ||
                  !listing.bookingEnabled ||
                  listing.verificationStatus === 'SUSPENDED' ||
                  listing.isDemo !== current.isDemo
                ) {
                  throw new AppointmentRequestError(
                    409,
                    'This clinic is not currently eligible to confirm a new time. You can reject the proposal and contact the clinic.',
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
                  throw new AppointmentRequestError(
                    409,
                    'Approved clinic verification is required to confirm a new time.',
                  )
                }

                if (
                  current.pet.ownerId !== ownerId ||
                  !listing.species.includes(current.pet.species)
                ) {
                  throw new AppointmentRequestError(
                    409,
                    'The pet is no longer eligible for this appointment.',
                  )
                }
                const availabilityError = await checkAppointmentAvailability(
                  tx,
                  current.vetListingId,
                  proposedStart,
                  proposedEnd,
                )
                
                if (availabilityError) {
                  throw new AppointmentRequestError(409, availabilityError)
                }

                // The proposed time was not reserved.
                // Check availability again before switching the slot.
                const overlap = await tx.appointment.findFirst({
                  where: {
                    id: { not: id },
                    status: {
                      in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
                    },
                    confirmedStartAt: { lt: proposedEnd },
                    confirmedEndAt: { gt: proposedStart },
                    OR: [
                      { providerUserId: current.providerUserId },
                      { vetListingId: current.vetListingId },
                      { petId: current.petId },
                    ],
                  },
                  select: { id: true },
                })

                if (overlap) {
                  throw new AppointmentRequestError(
                    409,
                    'The proposed time is no longer available. Your original slot remains reserved. You can reject the proposal and contact the clinic.',
                  )
                }
              }

              const confirmedStartAt =
                decision === 'ACCEPT' ? proposedStart : originalStart

              const confirmedEndAt =
                decision === 'ACCEPT' ? proposedEnd : originalEnd

              const updated = await tx.appointment.updateMany({
                where: {
                  id,
                  ownerId,
                  status: 'RESCHEDULE_PROPOSED',
                  version,
                },
                data: {
                  status: 'CONFIRMED',
                  confirmedStartAt,
                  confirmedEndAt,
                  ...(decision === 'ACCEPT'
                    ? { confirmedAt: now }
                    : {}),
                  proposedStartAt: null,
                  proposedEndAt: null,
                  responseDueAt: null,
                  version: { increment: 1 },
                },
              })

              if (updated.count !== 1) {
                throw new AppointmentRequestError(
                  409,
                  'This appointment changed. Refresh and check its status.',
                )
              }

              await tx.appointmentEvent.create({
                data: {
                  appointmentId: id,
                  actorId: ownerId,
                  version: version + 1,
                  action,
notifications: {
  create: {
    userId: current.providerUserId,
  },
},
previousStatus: 'RESCHEDULE_PROPOSED',
                  newStatus: 'CONFIRMED',
                  details: {
                    previousConfirmedStartAt:
                      originalStart.toISOString(),
                    previousConfirmedEndAt:
                      originalEnd.toISOString(),
                    proposedStartAt: proposedStart.toISOString(),
                    proposedEndAt: proposedEnd.toISOString(),
                    confirmedStartAt: confirmedStartAt.toISOString(),
                    confirmedEndAt: confirmedEndAt.toISOString(),
                    timeZone: current.timeZone,
                    isDemo: current.isDemo,
                  },
                },
              })

              return {
                id,
                status: 'CONFIRMED' as const,
                version: version + 1,
                confirmedStartAt,
                confirmedEndAt,
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
              decision === 'ACCEPT'
                ? appointment.isDemo
                  ? 'Demo time change accepted. No real appointment has been arranged.'
                  : 'New appointment time confirmed. No automatic notification was sent.'
                : 'Proposal rejected. The original appointment time is unchanged. No automatic notification was sent.',
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
            throw new AppointmentRequestError(
              409,
              'Another appointment changed at the same time. Refresh and try again.',
            )
          }

          throw error
        }
      }
    } catch (error) {
      if (error instanceof AppointmentRequestError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)
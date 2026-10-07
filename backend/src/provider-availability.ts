import { Router } from 'express'
import { prisma } from './db.js'
import type {} from './auth.js'
import { Prisma } from './generated/prisma/client.js'
import { checkAppointmentAvailability } from './availability-check.js'

export const providerAvailabilityRouter = Router()

providerAvailabilityRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const userId = req.session.userId

    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
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
        message: 'Please sign in with an active account.',
      })
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

// GET /api/provider/availability
providerAvailabilityRouter.get('/', async (req, res, next) => {
  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  try {
    const listing = await prisma.vetListing.findUnique({
      where: { userId },
      select: {
        id: true,
        clinicName: true,
        timeZone: true,
        isDemo: true,
        bookingEnabled: true,
        availabilityEnabled: true,
        availabilityVersion: true,
        availabilityWindows: {
          orderBy: [
            { weekday: 'asc' },
            { startMinute: 'asc' },
          ],
          select: {
            id: true,
            weekday: true,
            startMinute: true,
            endMinute: true,
          },
        },
        availabilityBlocks: {
          where: {
            endsAt: { gt: new Date() },
          },
          orderBy: [
            { startsAt: 'asc' },
            { id: 'asc' },
          ],
          take: 101,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            reason: true,
          },
        },
      },
    })

    if (!listing) {
      res.status(404).json({
        message: 'No clinic listing is linked to your vet account.',
      })
      return
    }

    const {
      availabilityWindows,
      availabilityBlocks,
      ...clinic
    } = listing

    res.json({
      clinic,
      windows: availabilityWindows,
      blocks: availabilityBlocks.slice(0, 100),
      hasMoreBlocks: availabilityBlocks.length > 100,
    })
  } catch (error) {
    next(error)
  }
})
class AvailabilityError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message)
    }
  }
  function runAvailabilityUpdate<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    })
  }
  
  async function protectActiveAppointments(
    tx: Prisma.TransactionClient,
    vetListingId: string,
  ) {
    const listing = await tx.vetListing.findUnique({
      where: { id: vetListingId },
      select: {
        availabilityEnabled: true,
        timeZone: true,
      },
    })
  
    if (!listing) {
      throw new AvailabilityError(404, 'Clinic not found.')
    }
  
    // Draft edits do not affect appointment availability.
    if (!listing.availabilityEnabled) return
  
    try {
      new Intl.DateTimeFormat(undefined, {
        timeZone: listing.timeZone,
      })
    } catch {
      throw new AvailabilityError(
        422,
        'The clinic time zone is invalid. No changes were saved.',
      )
    }
  
    const windowCount = await tx.vetAvailabilityWindow.count({
      where: { vetListingId },
    })
  
    if (windowCount === 0) {
      throw new AvailabilityError(
        422,
        'An active schedule must retain at least one working session. No changes were saved.',
      )
    }
  
    const now = new Date()
  
    const appointments = await tx.appointment.findMany({
      where: {
        vetListingId,
        status: {
          in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
        },
        OR: [
          { confirmedEndAt: { gt: now } },
          { confirmedStartAt: null },
          { confirmedEndAt: null },
          { status: 'RESCHEDULE_PROPOSED' },
        ],
      },
      orderBy: { id: 'asc' },
      take: 101,
      select: {
        id: true,
        status: true,
        confirmedStartAt: true,
        confirmedEndAt: true,
        proposedStartAt: true,
        proposedEndAt: true,
      },
    })
  
    if (appointments.length > 100) {
      throw new AvailabilityError(
        422,
        'This schedule requires a larger appointment review. No changes were saved.',
      )
    }
  
    for (const appointment of appointments) {
      if (
        !appointment.confirmedStartAt ||
        !appointment.confirmedEndAt ||
        appointment.confirmedEndAt <= appointment.confirmedStartAt
      ) {
        throw new AvailabilityError(
          422,
          `Appointment ${appointment.id} has invalid confirmed times. No changes were saved.`,
        )
      }
  
      if (appointment.confirmedEndAt > now) {
        const conflict = await checkAppointmentAvailability(
          tx,
          vetListingId,
          appointment.confirmedStartAt,
          appointment.confirmedEndAt,
        )
  
        if (conflict) {
          throw new AvailabilityError(
            422,
            `This edit conflicts with appointment ${appointment.id}: ${conflict} No changes were saved.`,
          )
        }
      }
  
      if (appointment.status === 'RESCHEDULE_PROPOSED') {
        if (
          !appointment.proposedStartAt ||
          !appointment.proposedEndAt ||
          appointment.proposedStartAt <= now
        ) {
          throw new AvailabilityError(
            422,
            `Resolve the expired or incomplete proposal for appointment ${appointment.id} first. No changes were saved.`,
          )
        }
  
        const conflict = await checkAppointmentAvailability(
          tx,
          vetListingId,
          appointment.proposedStartAt,
          appointment.proposedEndAt,
        )
  
        if (conflict) {
          throw new AvailabilityError(
            422,
            `This edit conflicts with the proposal for appointment ${appointment.id}: ${conflict} No changes were saved.`,
          )
        }
      }
    }
  }
  
  type WeeklyWindow = {
    weekday: number
    startMinute: number
    endMinute: number
  }
  
  // PUT /api/provider/availability/weekly
  providerAvailabilityRouter.put(
    '/weekly',
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
        Array.isArray(input) ||
        Object.keys(input).some(
          (key) => !['version', 'windows'].includes(key),
        ) ||
        !Number.isSafeInteger(input.version) ||
        input.version < 1 ||
        input.version >= 2147483647 ||
        !Array.isArray(input.windows) ||
        input.windows.length > 28
      ) {
        res.status(400).json({
          message:
            'Provide the current version and up to 28 weekly sessions.',
        })
        return
      }
  
      const windows: WeeklyWindow[] = []
  
      for (const window of input.windows) {
        if (
          !window ||
          typeof window !== 'object' ||
          Array.isArray(window) ||
          Object.keys(window).some(
            (key) =>
              !['weekday', 'startMinute', 'endMinute'].includes(key),
          ) ||
          !Number.isInteger(window.weekday) ||
          window.weekday < 1 ||
          window.weekday > 7 ||
          !Number.isInteger(window.startMinute) ||
          !Number.isInteger(window.endMinute) ||
          window.startMinute < 0 ||
          window.startMinute >= 1440 ||
          window.endMinute > 1440 ||
          window.endMinute - window.startMinute < 30
        ) {
          res.status(400).json({
            message:
              'Each session must have a weekday from 1–7 and valid same-day times lasting at least 30 minutes.',
          })
          return
        }
  
        windows.push({
          weekday: window.weekday,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })
      }
  
      windows.sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.startMinute - b.startMinute,
      )
  
      const sessionsPerDay = new Map<number, number>()
  
      for (let index = 0; index < windows.length; index += 1) {
        const current = windows[index]!
  
        const count =
          (sessionsPerDay.get(current.weekday) ?? 0) + 1
  
        sessionsPerDay.set(current.weekday, count)
  
        if (count > 4) {
          res.status(400).json({
            message: 'Use no more than four sessions per day.',
          })
          return
        }
  
        const previous = windows[index - 1]
  
        if (
          previous &&
          previous.weekday === current.weekday &&
          current.startMinute < previous.endMinute
        ) {
          res.status(400).json({
            message: 'Working-hour sessions on the same day cannot overlap.',
          })
          return
        }
      }
  
      const userId = req.session.userId
  
      if (!userId) {
        res.status(401).json({ message: 'Please sign in.' })
        return
      }
  
      const version = input.version as number
  
      try {
        const result = await runAvailabilityUpdate(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: {
              role: true,
              status: true,
            },
          })
  
          if (
            !user ||
            user.role !== 'VET' ||
            user.status !== 'ACTIVE'
          ) {
            throw new AvailabilityError(
              403,
              'An active vet account is required.',
            )
          }
  
          const listing = await tx.vetListing.findUnique({
            where: { userId },
            select: {
              id: true,
              availabilityVersion: true,
              availabilityEnabled: true,
            },
          })
  
          if (!listing) {
            throw new AvailabilityError(
              404,
              'No clinic listing is linked to your vet account.',
            )
          }
  
          
  
          if (listing.availabilityVersion !== version) {
            throw new AvailabilityError(
              409,
              'The schedule has changed. Reload it before saving again.',
            )
          }
  
          // Claim this version before replacing any sessions.
          const updated = await tx.vetListing.updateMany({
            where: {
              id: listing.id,
              userId,
              availabilityVersion: version,
              availabilityEnabled: listing.availabilityEnabled,
            },
            data: {
              availabilityVersion: { increment: 1 },
            },
          })
  
          if (updated.count !== 1) {
            throw new AvailabilityError(
              409,
              'The schedule has changed. Reload it before saving again.',
            )
          }
  
          await tx.vetAvailabilityWindow.deleteMany({
            where: { vetListingId: listing.id },
          })
  
          if (windows.length > 0) {
            await tx.vetAvailabilityWindow.createMany({
              data: windows.map((window) => ({
                vetListingId: listing.id,
                ...window,
              })),
            })
          }
           
          await protectActiveAppointments(tx, listing.id)
          await tx.auditEvent.create({
            data: {
              actorId: userId,
              actorLabel: 'Vet provider',
              action: 'VET_WEEKLY_AVAILABILITY_UPDATED',
              entityType: 'VetListing',
              entityId: listing.id,
              details: {
                version: version + 1,
                windows: windows.map((window) => ({
                  weekday: window.weekday,
                  startMinute: window.startMinute,
                  endMinute: window.endMinute,
                })),
              },
            },
          })
  
          return {
            availabilityVersion: version + 1,
            availabilityEnabled: listing.availabilityEnabled,
            windows,
          }
        })
  
        res.json({
          message: result.availabilityEnabled
            ? 'Working hours updated. Availability remains active.'
            : 'Draft working hours saved. Availability is not active yet.',
          ...result,
        })
      } catch (error) {
        if (error instanceof AvailabilityError) {
          res.status(error.statusCode).json({
            message: error.message,
          })
          return
        }
  
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002', 'P2028'].includes(error.code)
        ) {
          res.status(409).json({
            message: 'The schedule changed while saving. Reload it and check your changes.',
          })
          return
        }
  
        next(error)
      }
    },
  )
  // PUT /api/provider/availability/blocks
// Replaces the draft list of current/future blocked periods.
providerAvailabilityRouter.put('/blocks', async (req, res, next) => {
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

  const input = req.body

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['version', 'blocks'].includes(key),
    ) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    input.version >= 2147483647 ||
    !Array.isArray(input.blocks) ||
    input.blocks.length > 100
  ) {
    res.status(400).json({
      message: 'Provide the current version and up to 100 blocked periods.',
    })
    return
  }

  function parseUtc(value: unknown): Date | null {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value)
    ) {
      return null
    }

    const date = new Date(value)

    return Number.isFinite(date.getTime()) &&
      date.toISOString() === value
      ? date
      : null
  }

  const blocks: {
    startsAt: Date
    endsAt: Date
    reason: string | null
  }[] = []

  for (const block of input.blocks) {
    if (
      !block ||
      typeof block !== 'object' ||
      Array.isArray(block) ||
      Object.keys(block).some(
        (key) => !['startsAt', 'endsAt', 'reason'].includes(key),
      ) ||
      (
        block.reason !== undefined &&
        block.reason !== null &&
        (
          typeof block.reason !== 'string' ||
          block.reason.length > 500
        )
      )
    ) {
      res.status(400).json({
        message: 'Each blocked period needs valid dates and an optional reason up to 500 characters.',
      })
      return
    }

    const startsAt = parseUtc(block.startsAt)
    const endsAt = parseUtc(block.endsAt)

    if (!startsAt || !endsAt || endsAt <= startsAt) {
      res.status(400).json({
        message: 'Each blocked period must end after it starts.',
      })
      return
    }

    blocks.push({
      startsAt,
      endsAt,
      reason:
        typeof block.reason === 'string'
          ? block.reason.trim() || null
          : null,
    })
  }

  blocks.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  for (let index = 1; index < blocks.length; index += 1) {
    if (blocks[index]!.startsAt < blocks[index - 1]!.endsAt) {
      res.status(400).json({
        message: 'Blocked periods cannot overlap. Combine overlapping periods into one.',
      })
      return
    }
  }

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  try {
    const result = await runAvailabilityUpdate(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      })

      if (
        !user ||
        user.role !== 'VET' ||
        user.status !== 'ACTIVE'
      ) {
        throw new AvailabilityError(
          403,
          'An active vet account is required.',
        )
      }

      const listing = await tx.vetListing.findUnique({
        where: { userId },
        select: {
          id: true,
          availabilityVersion: true,
          availabilityEnabled: true,
        },
      })

      if (!listing) {
        throw new AvailabilityError(
          404,
          'No clinic is linked to your vet account.',
        )
      }

      

      const now = new Date()

      if (blocks.some((block) => block.endsAt <= now)) {
        throw new AvailabilityError(
          400,
          'Remove periods that have already ended, then save again.',
        )
      }

      const updated = await tx.vetListing.updateMany({
        where: {
          id: listing.id,
          userId,
          availabilityVersion: input.version,
          availabilityEnabled: listing.availabilityEnabled,
        },
        data: {
          availabilityVersion: { increment: 1 },
        },
      })

      if (updated.count !== 1) {
        throw new AvailabilityError(
          409,
          'Availability changed. Reload before saving again.',
        )
      }

      // Retain past blocks; replace only current/future draft blocks.
      await tx.vetAvailabilityBlock.deleteMany({
        where: {
          vetListingId: listing.id,
          endsAt: { gt: now },
        },
      })

      if (blocks.length > 0) {
        await tx.vetAvailabilityBlock.createMany({
          data: blocks.map((block) => ({
            vetListingId: listing.id,
            ...block,
          })),
        })
      }

      await protectActiveAppointments(tx, listing.id)

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          actorLabel: 'Vet provider',
          action: 'VET_AVAILABILITY_BLOCKS_UPDATED',
          entityType: 'VetListing',
          entityId: listing.id,
          details: {
            version: input.version + 1,
            blocks: blocks.map((block) => ({
              startsAt: block.startsAt.toISOString(),
              endsAt: block.endsAt.toISOString(),
              reason: block.reason,
            })),
          },
        },
      })

      return {
        availabilityVersion: input.version + 1,
        availabilityEnabled: listing.availabilityEnabled,
      }
    })

    res.json({
      message: result.availabilityEnabled
        ? 'Blocked periods updated. Availability remains active.'
        : 'Draft blocked periods saved.',
      ...result,
    })
  } catch (error) {
    if (error instanceof AvailabilityError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2034', 'P2002', 'P2028'].includes(error.code)
    ) {
      res.status(409).json({
        message: 'Availability changed. Reload before saving again.',
      })
      return
    }

    next(error)
  }
})
providerAvailabilityRouter.post('/activate', async (req, res, next) => {
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

  const input = req.body

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
      message: 'Provide the current availability version.',
    })
    return
  }

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true, status: true },
        })

        if (
          !user ||
          user.role !== 'VET' ||
          user.status !== 'ACTIVE'
        ) {
          throw new AvailabilityError(
            403,
            'An active vet account is required.',
          )
        }

        const listing = await tx.vetListing.findUnique({
          where: { userId },
          select: {
            id: true,
            timeZone: true,
            availabilityEnabled: true,
            availabilityVersion: true,
          },
        })

        if (!listing) {
          throw new AvailabilityError(
            404,
            'No clinic is linked to your vet account.',
          )
        }

        if (
          listing.availabilityEnabled ||
          listing.availabilityVersion !== input.version
        ) {
          throw new AvailabilityError(
            409,
            'Availability has changed or is already active. Reload the schedule.',
          )
        }

        try {
          new Intl.DateTimeFormat(undefined, {
            timeZone: listing.timeZone,
          })
        } catch {
          throw new AvailabilityError(
            409,
            'The clinic needs a valid time zone before activation.',
          )
        }

        const windowCount = await tx.vetAvailabilityWindow.count({
          where: { vetListingId: listing.id },
        })

        if (windowCount === 0) {
          throw new AvailabilityError(
            409,
            'Save at least one working-hours session before activation.',
          )
        }

        const now = new Date()

        const appointments = await tx.appointment.findMany({
          where: {
            vetListingId: listing.id,
            status: {
              in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
            },
            OR: [
              { confirmedEndAt: { gt: now } },
              { confirmedStartAt: null },
              { confirmedEndAt: null },
              { status: 'RESCHEDULE_PROPOSED' },
            ],
          },
          orderBy: { id: 'asc' },
          take: 101,
          select: {
            id: true,
            status: true,
            confirmedStartAt: true,
            confirmedEndAt: true,
            proposedStartAt: true,
            proposedEndAt: true,
          },
        })

        // Bound the work done inside this interactive transaction.
        if (appointments.length > 100) {
          throw new AvailabilityError(
            409,
            'This clinic needs a larger appointment review before activation. Availability remains disabled.',
          )
        }

        const updated = await tx.vetListing.updateMany({
          where: {
            id: listing.id,
            userId,
            availabilityEnabled: false,
            availabilityVersion: input.version,
          },
          data: {
            availabilityEnabled: true,
            availabilityVersion: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new AvailabilityError(
            409,
            'Availability changed. Reload and try again.',
          )
        }

        // This transaction sees the enabled flag above.
        // Any error below rolls back the activation.
        for (const appointment of appointments) {
          if (
            !appointment.confirmedStartAt ||
            !appointment.confirmedEndAt
          ) {
            throw new AvailabilityError(
              409,
              `Appointment ${appointment.id} has incomplete confirmed times. Activation was not saved.`,
            )
          }

          if (appointment.confirmedEndAt > now) {
            const conflict = await checkAppointmentAvailability(
              tx,
              listing.id,
              appointment.confirmedStartAt,
              appointment.confirmedEndAt,
            )

            if (conflict) {
              throw new AvailabilityError(
                409,
                `Appointment ${appointment.id} conflicts with the draft schedule: ${conflict} Adjust the draft before activating.`,
              )
            }
          }

          if (appointment.status === 'RESCHEDULE_PROPOSED') {
            if (
              !appointment.proposedStartAt ||
              !appointment.proposedEndAt ||
              appointment.proposedStartAt <= now
            ) {
              throw new AvailabilityError(
                409,
                `Resolve the expired or incomplete proposal for appointment ${appointment.id} before activating.`,
              )
            }

            const conflict = await checkAppointmentAvailability(
              tx,
              listing.id,
              appointment.proposedStartAt,
              appointment.proposedEndAt,
            )

            if (conflict) {
              throw new AvailabilityError(
                409,
                `The proposal for appointment ${appointment.id} conflicts with the draft schedule: ${conflict}`,
              )
            }
          }
        }

        await tx.auditEvent.create({
          data: {
            actorId: userId,
            actorLabel: 'Vet provider',
            action: 'VET_AVAILABILITY_ACTIVATED',
            entityType: 'VetListing',
            entityId: listing.id,
            details: {
              version: input.version + 1,
              reviewedAppointments: appointments.length,
            },
          },
        })

        return {
          availabilityEnabled: true,
          availabilityVersion: input.version + 1,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    )

    res.json({
      message: 'Availability activated.',
      ...result,
    })
  } catch (error) {
    if (error instanceof AvailabilityError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2034', 'P2002', 'P2028'].includes(error.code)
    ) {
      res.status(409).json({
        message: 'Activation could not finish. Reload the schedule and try again.',
      })
      return
    }

    next(error)
  }
})
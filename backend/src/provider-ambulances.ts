import { Router } from 'express'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import type {} from './auth.js'

export const providerAmbulancesRouter = Router()

providerAmbulancesRouter.get('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        ambulanceListing: {
          select: {
            id: true,
            version: true,
            providerName: true,
            description: true,
            city: true,
            state: true,
            phone: true,
            openingHours: true,
            timeZone: true,
            species: true,
            animalRestrictions: true,
            status: true,
            isDemo: true,
            verificationStatus: true,
            availability: true,
            availabilityUpdatedAt: true,
            requestsEnabled: true,
            serviceAreas: {
              orderBy: [
                { state: 'asc' },
                { city: 'asc' },
              ],
              select: {
                city: true,
                state: true,
              },
            },
          },
        },
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        message: 'Please sign in with an active account.',
      })
      return
    }

    if (user.role !== 'AMBULANCE_PROVIDER') {
      res.status(403).json({
        message: 'An ambulance-provider account is required.',
      })
      return
    }

    if (user.ambulanceListing?.isDemo) {
      res.status(403).json({
        message: 'A real-provider listing is required. Contact an administrator.',
      })
      return
    }

    res.json({ listing: user.ambulanceListing })
  } catch (error) {
    next(error)
  }
})

class ProviderAmbulanceError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message)
    }
  }
  
  providerAmbulancesRouter.post(
    '/availability',
    async (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store')
  
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
          (key) => !['version', 'availability'].includes(key),
        ) ||
        !Number.isSafeInteger(input.version) ||
        input.version < 1 ||
        input.version >= 2147483647 ||
        !['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'].includes(
          input.availability,
        )
      ) {
        res.status(400).json({
          message: 'Provide the current version and a valid availability.',
        })
        return
      }
  
      const actorId = req.session.userId
  
      if (!actorId) {
        res.status(401).json({ message: 'Please sign in.' })
        return
      }
  
      const version = input.version as number
      const availability = input.availability as
        | 'AVAILABLE'
        | 'UNAVAILABLE'
        | 'UNKNOWN'
  
      try {
        const listing = await prisma.$transaction(
          async (tx) => {
            const provider = await tx.user.findUnique({
              where: { id: actorId },
              select: {
                role: true,
                status: true,
              },
            })
  
            if (!provider || provider.status !== 'ACTIVE') {
              throw new ProviderAmbulanceError(
                401,
                'Please sign in with an active account.',
              )
            }
  
            if (provider.role !== 'AMBULANCE_PROVIDER') {
              throw new ProviderAmbulanceError(
                403,
                'An ambulance-provider account is required.',
              )
            }
  
            const current = await tx.ambulanceListing.findUnique({
              where: { userId: actorId },
              select: {
                id: true,
                version: true,
                isDemo: true,
                status: true,
                verificationStatus: true,
                availability: true,
              },
            })
  
            if (!current) {
              throw new ProviderAmbulanceError(
                404,
                'No ambulance listing is linked to your account.',
              )
            }
  
            if (
              current.isDemo ||
              current.status !== 'PUBLISHED' ||
              current.verificationStatus !== 'APPROVED'
            ) {
              throw new ProviderAmbulanceError(
                409,
                'Your listing must be approved and published before updating availability.',
              )
            }
  
            if (current.version !== version) {
              throw new ProviderAmbulanceError(
                409,
                'Your listing changed. Refresh before updating availability.',
              )
            }
  
            const now = new Date()
  
            const updated = await tx.ambulanceListing.updateMany({
              where: {
                id: current.id,
                userId: actorId,
                version,
                isDemo: false,
                status: 'PUBLISHED',
                verificationStatus: 'APPROVED',
              },
              data: {
                availability,
                availabilityUpdatedAt: now,
                version: { increment: 1 },
              },
            })
  
            if (updated.count !== 1) {
              throw new ProviderAmbulanceError(
                409,
                'Your listing changed. Refresh before trying again.',
              )
            }
  
            await tx.auditEvent.create({
              data: {
                actorId,
                actorLabel: 'Ambulance provider',
                action: 'AMBULANCE_AVAILABILITY_UPDATED',
                entityType: 'AmbulanceListing',
                entityId: current.id,
                details: {
                  reason: 'Provider updated their availability.',
                  previousAvailability: current.availability,
                  newAvailability: availability,
                  version: version + 1,
                },
              },
            })
  
            return {
              id: current.id,
              version: version + 1,
              availability,
              availabilityUpdatedAt: now,
            }
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        )
  
        res.json({
          message: 'Availability recorded.',
          listing,
        })
      } catch (error) {
        if (error instanceof ProviderAmbulanceError) {
          res.status(error.statusCode).json({ message: error.message })
          return
        }
  
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          res.status(409).json({
            message: 'Your listing changed. Refresh and check its status.',
          })
          return
        }
  
        next(error)
      }
    },
  )

  // GET /api/provider/ambulance/requests
providerAmbulancesRouter.get('/requests', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
  
    const userId = req.session.userId
  
    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    try {
      const provider = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      })
  
      if (!provider || provider.status !== 'ACTIVE') {
        res.status(401).json({
          message: 'Please sign in with an active account.',
        })
        return
      }
  
      if (provider.role !== 'AMBULANCE_PROVIDER') {
        res.status(403).json({
          message: 'An ambulance-provider account is required.',
        })
        return
      }
  
      const requests = await prisma.transportRequest.findMany({
        where: { providerUserId: userId },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: 51,
        select: {
          id: true,
          status: true,
          version: true,
          petName: true,
          petSpecies: true,
          pickupAddress: true,
          pickupCity: true,
          pickupState: true,
          pickupPostalCode: true,
          destinationAddress: true,
          destinationCity: true,
          destinationState: true,
          destinationPostalCode: true,
          contactName: true,
          contactPhone: true,
          notes: true,
          requestedPickupAt: true,
          confirmedPickupAt: true,
          enRouteAt: true,
          arrivedAt: true,
          completedAt: true,
          responseDueAt: true,
          createdAt: true,
          listing: {
            select: { providerName: true },
          },
        },
      })
  
      res.json({
        requests: requests.slice(0, 50),
        hasMore: requests.length > 50,
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/provider/ambulance/requests/:id/respond
providerAmbulancesRouter.post(
    '/requests/:id/respond',
    async (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store')
  
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
        res.status(400).json({ message: 'Invalid request ID.' })
        return
      }
  
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (key) => !['version', 'action', 'reason'].includes(key),
        ) ||
        !Number.isSafeInteger(input.version) ||
        input.version < 1 ||
        input.version >= 2147483647 ||
        !['ACCEPT', 'DECLINE'].includes(input.action) ||
        typeof input.reason !== 'string' ||
        input.reason.trim().length < 5 ||
        input.reason.length > 1000
      ) {
        res.status(400).json({
          message:
            'Provide the current version, ACCEPT or DECLINE, and a reason of 5–1000 characters.',
        })
        return
      }
  
      const actorId = req.session.userId
  
      if (!actorId) {
        res.status(401).json({ message: 'Please sign in.' })
        return
      }
  
      const version = input.version as number
      const action = input.action as 'ACCEPT' | 'DECLINE'
      const reason = input.reason.trim() as string
  
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const provider = await tx.user.findUnique({
              where: { id: actorId },
              select: { role: true, status: true },
            })
  
            if (!provider || provider.status !== 'ACTIVE') {
              throw new ProviderAmbulanceError(
                401,
                'Please sign in with an active account.',
              )
            }
  
            if (provider.role !== 'AMBULANCE_PROVIDER') {
              throw new ProviderAmbulanceError(
                403,
                'An ambulance-provider account is required.',
              )
            }
  
            const current = await tx.transportRequest.findFirst({
              where: {
                id,
                providerUserId: actorId,
              },
              include: {
                listing: {
                  select: {
                    userId: true,
                    isDemo: true,
                    status: true,
                    publishedAt: true,
                    verificationStatus: true,
                    verificationReviewedAt: true,
                    verificationReviewedById: true,
                  },
                },
              },
            })
  
            if (!current) {
              throw new ProviderAmbulanceError(
                404,
                'Transport request not found.',
              )
            }
  
            if (
              current.version !== version ||
              current.status !== 'REQUESTED'
            ) {
              throw new ProviderAmbulanceError(
                409,
                'This request changed or has already been handled. Refresh the inbox.',
              )
            }
  
            const now = new Date()
            const expired = current.responseDueAt <= now
  
            // Expiry takes precedence over acceptance or decline.
            // Do not throw after updating expiry: the transaction must commit.
            if (!expired && action === 'ACCEPT') {
              const listing = current.listing
  
              if (
                current.isDemo ||
                listing.isDemo ||
                listing.userId !== actorId ||
                listing.status !== 'PUBLISHED' ||
                !listing.publishedAt ||
                listing.publishedAt > now ||
                listing.verificationStatus !== 'APPROVED' ||
                !listing.verificationReviewedAt ||
                listing.verificationReviewedAt > now ||
                !listing.verificationReviewedById
              ) {
                throw new ProviderAmbulanceError(
                  409,
                  'Your listing must still be approved, published, and linked to your account to accept.',
                )
              }
  
              if (current.requestedPickupAt <= now) {
                throw new ProviderAmbulanceError(
                  409,
                  'The requested pickup time has passed.',
                )
              }
            }
  
            const status = expired
              ? 'EXPIRED'
              : action === 'ACCEPT'
                ? 'ACCEPTED'
                : 'DECLINED'
  
            const updated = await tx.transportRequest.updateMany({
              where: {
                id,
                providerUserId: actorId,
                version,
                status: 'REQUESTED',
              },
              data: {
                status,
                confirmedPickupAt:
                  status === 'ACCEPTED'
                    ? current.requestedPickupAt
                    : null,
                acceptedAt: status === 'ACCEPTED' ? now : null,
                declinedAt: status === 'DECLINED' ? now : null,
                expiredAt: status === 'EXPIRED' ? now : null,
                version: { increment: 1 },
              },
            })
  
            if (updated.count !== 1) {
              throw new ProviderAmbulanceError(
                409,
                'This request changed. Refresh before trying again.',
              )
            }
  
            await tx.transportRequestEvent.create({
              data: {
                transportRequestId: id,
                actorId,
                version: version + 1,
                action:
                  status === 'EXPIRED'
                    ? 'TRANSPORT_REQUEST_EXPIRED'
                    : status === 'ACCEPTED'
                      ? 'TRANSPORT_REQUEST_ACCEPTED'
                      : 'TRANSPORT_REQUEST_DECLINED',
                previousStatus: 'REQUESTED',
                newStatus: status,
                reason:
                  status === 'EXPIRED'
                    ? 'The response deadline passed before the provider responded.'
                    : reason,
                details: {
                  attemptedAction: action,
                  responseDueAt: current.responseDueAt.toISOString(),
                  confirmedPickupAt:
                    status === 'ACCEPTED'
                      ? current.requestedPickupAt.toISOString()
                      : null,
                },
              },
            })
  
            return {
              expired,
              request: {
                id,
                status,
                version: version + 1,
              },
            }
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        )
  
        res.status(result.expired ? 409 : 200).json({
          message: result.expired
            ? 'The response deadline passed. The request has been marked expired.'
            : result.request.status === 'ACCEPTED'
              ? 'Request accepted for the original requested pickup time.'
              : 'Request declined.',
          request: result.request,
        })
      } catch (error) {
        if (error instanceof ProviderAmbulanceError) {
          res.status(error.statusCode).json({ message: error.message })
          return
        }
  
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          res.status(409).json({
            message: 'This request changed. Refresh and check its status.',
          })
          return
        }
  
        next(error)
      }
    },
  )

  // POST /api/provider/ambulance/requests/:id/complete
providerAmbulancesRouter.post(
    '/requests/:id/complete',
    async (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store')
  
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
  
      const actorId = req.session.userId
  
      if (!actorId) {
        res.status(401).json({ message: 'Please sign in.' })
        return
      }
  
      const id = req.params.id
      const input = req.body
  
      if (
        typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ) {
        res.status(400).json({ message: 'Invalid request ID.' })
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
        input.reason.trim().length < 5 ||
        input.reason.length > 1000
      ) {
        res.status(400).json({
          message:
            'Provide the current version and a completion note of 5–1000 characters.',
        })
        return
      }
  
      const version = input.version as number
      const reason = input.reason.trim() as string
  
      try {
        const request = await prisma.$transaction(
          async (tx) => {
            const provider = await tx.user.findUnique({
              where: { id: actorId },
              select: { role: true, status: true },
            })
  
            if (!provider || provider.status !== 'ACTIVE') {
              throw new ProviderAmbulanceError(
                401,
                'Please sign in with an active account.',
              )
            }
  
            if (provider.role !== 'AMBULANCE_PROVIDER') {
              throw new ProviderAmbulanceError(
                403,
                'An ambulance-provider account is required.',
              )
            }
  
            const current = await tx.transportRequest.findFirst({
              where: {
                id,
                providerUserId: actorId,
              },
              select: {
                id: true,
                version: true,
                status: true,
                confirmedPickupAt: true,
                arrivedAt: true,
                isDemo: true,
              },
            })
  
            if (!current) {
              throw new ProviderAmbulanceError(
                404,
                'Transport request not found.',
              )
            }
  
            if (current.version !== version) {
              throw new ProviderAmbulanceError(
                409,
                'This request changed. Refresh before trying again.',
              )
            }
  
            if (current.isDemo || current.status !== 'ARRIVED') {
              throw new ProviderAmbulanceError(
                409,
                'Record arrival at pickup before marking transport completed.',
              )
            }
  
            const now = new Date()

            if (
              !current.confirmedPickupAt ||
              !current.arrivedAt ||
              current.arrivedAt > now
            ) {
              throw new ProviderAmbulanceError(
                409,
                'A valid confirmed pickup and arrival record are required.',
              )
            }
  
            const updated = await tx.transportRequest.updateMany({
              where: {
                id,
                providerUserId: actorId,
                version,
                status: 'ARRIVED',
              },
              data: {
                status: 'COMPLETED',
                completedAt: now,
                version: { increment: 1 },
              },
            })
  
            if (updated.count !== 1) {
              throw new ProviderAmbulanceError(
                409,
                'This request changed. Refresh and check its status.',
              )
            }
  
            await tx.transportRequestEvent.create({
              data: {
                transportRequestId: id,
                actorId,
                version: version + 1,
                action: 'TRANSPORT_REQUEST_COMPLETED',
                previousStatus: 'ARRIVED',
                newStatus: 'COMPLETED',
                reason,
                details: {
                  completedAt: now.toISOString(),
                  confirmedPickupAt:
                    current.confirmedPickupAt.toISOString(),
                },
              },
            })
  
            return {
              id,
              version: version + 1,
              status: 'COMPLETED',
              completedAt: now,
            }
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        )
  
        res.json({
          message: 'Transport marked completed.',
          request,
        })
      } catch (error) {
        if (error instanceof ProviderAmbulanceError) {
          res.status(error.statusCode).json({ message: error.message })
          return
        }
  
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          res.status(409).json({
            message: 'This request changed. Refresh and check its status.',
          })
          return
        }
  
        next(error)
      }
    },
  )

  // POST /api/provider/ambulance/requests/:id/journey
providerAmbulancesRouter.post(
  '/requests/:id/journey',
  async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')

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

    const actorId = req.session.userId

    if (!actorId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const id = req.params.id
    const input = req.body

    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({ message: 'Invalid request ID.' })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['version', 'action', 'reason'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      !['START_JOURNEY', 'MARK_ARRIVED'].includes(input.action) ||
      typeof input.reason !== 'string' ||
      input.reason.trim().length < 5 ||
      input.reason.length > 1000
    ) {
      res.status(400).json({
        message: 'Provide the current version, a valid action, and a note of 5–1000 characters.',
      })
      return
    }

    const version = input.version as number
    const action = input.action as 'START_JOURNEY' | 'MARK_ARRIVED'
    const reason = input.reason.trim() as string

    const previousStatus =
      action === 'START_JOURNEY' ? 'ACCEPTED' : 'EN_ROUTE'

    const newStatus =
      action === 'START_JOURNEY' ? 'EN_ROUTE' : 'ARRIVED'

    try {
      const request = await prisma.$transaction(
        async (tx) => {
          const provider = await tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, status: true },
          })

          if (!provider || provider.status !== 'ACTIVE') {
            throw new ProviderAmbulanceError(
              401,
              'Please sign in with an active account.',
            )
          }

          if (provider.role !== 'AMBULANCE_PROVIDER') {
            throw new ProviderAmbulanceError(
              403,
              'An ambulance-provider account is required.',
            )
          }

          const current = await tx.transportRequest.findFirst({
            where: { id, providerUserId: actorId },
            select: {
              id: true,
              version: true,
              status: true,
              isDemo: true,
              confirmedPickupAt: true,
              enRouteAt: true,
              listing: {
                select: {
                  userId: true,
                  isDemo: true,
                  status: true,
                  verificationStatus: true,
                },
              },
            },
          })

          if (!current) {
            throw new ProviderAmbulanceError(
              404,
              'Transport request not found.',
            )
          }

          if (
            current.version !== version ||
            current.status !== previousStatus
          ) {
            throw new ProviderAmbulanceError(
              409,
              'This request changed or is not at the required journey stage. Refresh the inbox.',
            )
          }

          if (current.isDemo || !current.confirmedPickupAt) {
            throw new ProviderAmbulanceError(
              409,
              'A real request with a confirmed pickup is required.',
            )
          }

          // Starting a new journey requires an eligible listing.
          if (
            action === 'START_JOURNEY' &&
            (
              current.listing.isDemo ||
              current.listing.userId !== actorId ||
              current.listing.status !== 'PUBLISHED' ||
              current.listing.verificationStatus !== 'APPROVED'
            )
          ) {
            throw new ProviderAmbulanceError(
              409,
              'Your listing must be approved, published, and linked to your account to start a journey.',
            )
          }

          const now = new Date()

          if (
            action === 'MARK_ARRIVED' &&
            (!current.enRouteAt || current.enRouteAt > now)
          ) {
            throw new ProviderAmbulanceError(
              409,
              'A valid journey-start record is required before arrival.',
            )
          }

          const updated = await tx.transportRequest.updateMany({
            where: {
              id,
              providerUserId: actorId,
              version,
              status: previousStatus,
            },
            data: {
              status: newStatus,
              ...(action === 'START_JOURNEY'
                ? { enRouteAt: now }
                : { arrivedAt: now }),
              version: { increment: 1 },
            },
          })

          if (updated.count !== 1) {
            throw new ProviderAmbulanceError(
              409,
              'This request changed. Refresh before trying again.',
            )
          }

          await tx.transportRequestEvent.create({
            data: {
              transportRequestId: id,
              actorId,
              version: version + 1,
              action:
                action === 'START_JOURNEY'
                  ? 'TRANSPORT_REQUEST_EN_ROUTE'
                  : 'TRANSPORT_REQUEST_ARRIVED',
              previousStatus,
              newStatus,
              reason,
              details: {
                recordedAt: now.toISOString(),
              },
            },
          })

          return {
            id,
            version: version + 1,
            status: newStatus,
          }
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      )

      res.json({
        message:
          action === 'START_JOURNEY'
            ? 'Journey started. Status is now En route.'
            : 'Arrival at the pickup location recorded.',
        request,
      })
    } catch (error) {
      if (error instanceof ProviderAmbulanceError) {
        res.status(error.statusCode).json({ message: error.message })
        return
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        res.status(409).json({
          message: 'This request changed. Refresh and check its status.',
        })
        return
      }

      next(error)
    }
  },
)
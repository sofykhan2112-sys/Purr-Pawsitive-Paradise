import { createHash } from 'node:crypto'
import { Router } from 'express'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import type {} from './auth.js'

export const transportRequestsRouter = Router()

class TransportRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

transportRequestsRouter.post('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  const allowedOrigin =
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

  const origin = req.get('origin')

  if (
    (origin && origin !== allowedOrigin) ||
    req.get('sec-fetch-site') === 'cross-site'
  ) {
    res.status(403).json({ message: 'Request origin is not allowed.' })
    return
  }

  if (!req.is('application/json')) {
    res.status(415).json({ message: 'Send the request as JSON.' })
    return
  }

  const ownerId = req.session.userId

  if (!ownerId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const input = req.body
  const allowedFields = [
    'ambulanceListingId',
    'petId',
    'idempotencyKey',
    'pickupAddress',
    'pickupCity',
    'pickupState',
    'pickupPostalCode',
    'destinationAddress',
    'destinationCity',
    'destinationState',
    'destinationPostalCode',
    'contactName',
    'contactPhone',
    'notes',
    'requestedPickupAt',
  ]

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowedFields.includes(key))
  ) {
    res.status(400).json({ message: 'Provide valid request details.' })
    return
  }

  try {
    function textField(
      key: string,
      min: number,
      max: number,
      optional = false,
    ) {
      const value = input[key]

      if (optional && (value === undefined || value === null)) {
        return ''
      }

      if (
        typeof value !== 'string' ||
        value.length > max ||
        value.trim().length < min
      ) {
        throw new TransportRequestError(
          400,
          `${key} must contain ${min}–${max} characters.`,
        )
      }

      return value.trim()
    }

    function uuidField(key: string) {
      const value = textField(key, 36, 36)

      if (!uuidPattern.test(value)) {
        throw new TransportRequestError(400, `Invalid ${key}.`)
      }

      return value.toLowerCase()
    }

    function locationField(key: string) {
      return textField(key, 2, 100).replace(/\s+/g, ' ')
    }

    const ambulanceListingId = uuidField('ambulanceListingId')
    const petId = uuidField('petId')
    const idempotencyKey = uuidField('idempotencyKey')

    const pickupAddress = textField('pickupAddress', 5, 500)
    const pickupCity = locationField('pickupCity')
    const pickupState = locationField('pickupState')
    const pickupPostalCode = textField(
      'pickupPostalCode', 0, 20, true,
    )

    const destinationAddress = textField('destinationAddress', 5, 500)
    const destinationCity = locationField('destinationCity')
    const destinationState = locationField('destinationState')
    const destinationPostalCode = textField(
      'destinationPostalCode', 0, 20, true,
    )

    const contactName = textField('contactName', 2, 100)
    const contactPhone = textField('contactPhone', 7, 30)
      .replace(/[\s().-]/g, '')

    const notes = textField('notes', 0, 1000, true)

    if (!/^\+?\d{7,15}$/.test(contactPhone)) {
      throw new TransportRequestError(
        400,
        'Enter a contact phone number with 7–15 digits.',
      )
    }

    for (const postalCode of [
      pickupPostalCode,
      destinationPostalCode,
    ]) {
      if (postalCode && !/^[1-9]\d{5}$/.test(postalCode)) {
        throw new TransportRequestError(
          400,
          'Indian PIN codes must contain six digits and cannot start with zero.',
        )
      }
    }

    const requestedTime = textField('requestedPickupAt', 20, 24)

    // The frontend must send a UTC timestamp using toISOString().
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
        requestedTime,
      )
    ) {
      throw new TransportRequestError(
        400,
        'Send the pickup time as a UTC ISO timestamp.',
      )
    }

    const requestedPickupAt = new Date(requestedTime)

    if (
      !Number.isFinite(requestedPickupAt.getTime()) ||
      requestedPickupAt.toISOString() !== requestedTime
    ) {
      throw new TransportRequestError(400, 'Invalid pickup time.')
    }

    // Fixed field order produces a stable fingerprint for retries.
    const payload = {
      ambulanceListingId,
      petId,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupPostalCode,
      destinationAddress,
      destinationCity,
      destinationState,
      destinationPostalCode,
      contactName,
      contactPhone,
      notes,
      requestedPickupAt: requestedPickupAt.toISOString(),
    }

    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')

    const result = await prisma.$transaction(
      async (tx) => {
        const owner = await tx.user.findUnique({
          where: { id: ownerId },
          select: { role: true, status: true },
        })

        if (!owner || owner.status !== 'ACTIVE') {
          throw new TransportRequestError(
            401,
            'Please sign in with an active account.',
          )
        }

        if (owner.role !== 'OWNER') {
          throw new TransportRequestError(
            403,
            'A pet-owner account is required.',
          )
        }

        // Check retries before time and provider eligibility.
        const existing = await tx.transportRequest.findUnique({
          where: {
            ownerId_idempotencyKey: { ownerId, idempotencyKey },
          },
          select: {
            id: true,
            status: true,
            version: true,
            responseDueAt: true,
            requestFingerprint: true,
          },
        })

        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint) {
            throw new TransportRequestError(
              409,
              'This submission key was already used with different details.',
            )
          }

          return {
            replayed: true,
            request: {
              id: existing.id,
              status: existing.status,
              version: existing.version,
              responseDueAt: existing.responseDueAt,
            },
          }
        }

        const now = new Date()
        const pickupMs = requestedPickupAt.getTime()
        const earliest = now.getTime() + 15 * 60 * 1000
        const latest = now.getTime() + 7 * 24 * 60 * 60 * 1000

        if (pickupMs < earliest || pickupMs > latest) {
          throw new TransportRequestError(
            400,
            'Choose a pickup time between 15 minutes and 7 days ahead.',
          )
        }

        const pet = await tx.pet.findFirst({
          where: { id: petId, ownerId },
          select: { id: true, name: true, species: true },
        })

        if (!pet) {
          throw new TransportRequestError(
            404,
            'That pet was not found in your account.',
          )
        }

        const listing = await tx.ambulanceListing.findUnique({
          where: { id: ambulanceListingId },
          select: {
            id: true,
            userId: true,
            isDemo: true,
            status: true,
            publishedAt: true,
            countryCode: true,
            verificationStatus: true,
            verificationReviewedAt: true,
            verificationReviewedById: true,
            requestsEnabled: true,
            availability: true,
            availabilityUpdatedAt: true,
            species: true,
            timeZone: true,
            user: {
              select: { role: true, status: true },
            },
            serviceAreas: {
              select: {
                countryCode: true,
                cityKey: true,
                stateKey: true,
              },
            },
          },
        })

        if (!listing) {
          throw new TransportRequestError(404, 'Provider not found.')
        }

        if (
          listing.isDemo ||
          listing.countryCode !== 'IN' ||
          listing.status !== 'PUBLISHED' ||
          !listing.publishedAt ||
          listing.publishedAt > now ||
          listing.verificationStatus !== 'APPROVED' ||
          !listing.verificationReviewedAt ||
          listing.verificationReviewedAt > now ||
          !listing.verificationReviewedById ||
          !listing.requestsEnabled ||
          !listing.userId ||
          listing.user?.role !== 'AMBULANCE_PROVIDER' ||
          listing.user.status !== 'ACTIVE'
        ) {
          throw new TransportRequestError(
            409,
            'This provider is not accepting online transport requests.',
          )
        }

        const availabilityAge = listing.availabilityUpdatedAt
          ? now.getTime() - listing.availabilityUpdatedAt.getTime()
          : Infinity

        if (
          listing.availability !== 'AVAILABLE' ||
          availabilityAge < 0 ||
          availabilityAge >= 30 * 60 * 1000
        ) {
          throw new TransportRequestError(
            409,
            'The provider has not recently confirmed availability. Contact them directly.',
          )
        }

        if (!listing.species.includes(pet.species)) {
          throw new TransportRequestError(
            400,
            'This provider does not list support for your pet’s species.',
          )
        }

        const covered = listing.serviceAreas.some(
          (area) =>
            area.countryCode === 'IN' &&
            area.cityKey === pickupCity.toLowerCase() &&
            area.stateKey === pickupState.toLowerCase(),
        )

        if (!covered) {
          throw new TransportRequestError(
            400,
            'Your pickup city and state are outside the listed coverage.',
          )
        }

        // Destination suitability is reviewed by the provider.
        const responseDueAt = new Date(
          Math.min(
            now.getTime() + 30 * 60 * 1000,
            pickupMs - 5 * 60 * 1000,
          ),
        )

        const request = await tx.transportRequest.create({
          data: {
            ownerId,
            petId: pet.id,
            ambulanceListingId: listing.id,
            providerUserId: listing.userId,
            petName: pet.name,
            petSpecies: pet.species,
            pickupAddress,
            pickupCity,
            pickupState,
            pickupCountryCode: 'IN',
            pickupPostalCode: pickupPostalCode || null,
            destinationAddress,
            destinationCity,
            destinationState,
            destinationCountryCode: 'IN',
            destinationPostalCode: destinationPostalCode || null,
            contactName,
            contactPhone,
            notes: notes || null,
            requestedPickupAt,
            timeZone: listing.timeZone,
            isDemo: false,
            idempotencyKey,
            requestFingerprint,
            responseDueAt,
            status: 'REQUESTED',
            version: 1,
            events: {
              create: {
                actorId: ownerId,
                version: 1,
                action: 'TRANSPORT_REQUEST_CREATED',
                newStatus: 'REQUESTED',
                reason: 'Owner submitted a transport request.',
                details: {
                  requestedPickupAt: requestedPickupAt.toISOString(),
                  responseDueAt: responseDueAt.toISOString(),
                },
              },
            },
          },
          select: {
            id: true,
            status: true,
            version: true,
            responseDueAt: true,
          },
        })

        return { replayed: false, request }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    )

    res.status(result.replayed ? 200 : 201).json({
      message: result.replayed
        ? 'Existing request returned. No duplicate was created.'
        : 'Request submitted. A vehicle and pickup are not yet confirmed.',
      ...result,
    })
  } catch (error) {
    if (error instanceof TransportRequestError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      res.status(409).json({
        message:
          'A concurrent change occurred. Retry the same submission with the same key and details.',
        retryable: true,
      })
      return
    }

    next(error)
  }
})

// GET /api/transport-requests
transportRequestsRouter.get('/', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
  
    const ownerId = req.session.userId
  
    if (!ownerId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    const page = req.query.page
  
    if (
      page !== undefined &&
      (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page))
    ) {
      res.status(400).json({
        message: 'Page must be a positive number up to 99999.',
      })
      return
    }
  
    const pageNumber = page === undefined ? 1 : Number(page)
    const pageSize = 12
  
    try {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { role: true, status: true },
      })
  
      if (!owner || owner.status !== 'ACTIVE') {
        res.status(401).json({
          message: 'Please sign in with an active account.',
        })
        return
      }
  
      if (owner.role !== 'OWNER') {
        res.status(403).json({
          message: 'A pet-owner account is required.',
        })
        return
      }
  
      const [requests, total] = await prisma.$transaction(
        [
          prisma.transportRequest.findMany({
            where: { ownerId },
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
            select: {
              id: true,
              status: true,
              version: true,
              petName: true,
              petSpecies: true,
              pickupAddress: true,
              pickupCity: true,
              pickupState: true,
              destinationAddress: true,
              destinationCity: true,
              destinationState: true,
              requestedPickupAt: true,
              confirmedPickupAt: true,
              enRouteAt: true,
              arrivedAt: true,
              completedAt: true,
              responseDueAt: true,
              createdAt: true,
              listing: {
                select: {
                  providerName: true,
                },
              },
              events: {
                where: {
                  action: {
                    in: [
                      'TRANSPORT_REQUEST_ACCEPTED',
                      'TRANSPORT_REQUEST_DECLINED',
                      'TRANSPORT_REQUEST_EN_ROUTE',
                      'TRANSPORT_REQUEST_ARRIVED',
                      'TRANSPORT_REQUEST_COMPLETED',
                    ],
                  },
                },
                orderBy: { version: 'desc' },
                take: 1,
                select: {
                  action: true,
                  reason: true,
                  createdAt: true,
                },
              },
            },
          }),
          prisma.transportRequest.count({
            where: { ownerId },
          }),
        ],
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      )
  
      res.json({
        requests,
        total,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /api/transport-requests/:id/cancel
transportRequestsRouter.post('/:id/cancel', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
  
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  
    const origin = req.get('origin')
  
    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({ message: 'Request origin is not allowed.' })
      return
    }
  
    if (!req.is('application/json')) {
      res.status(415).json({ message: 'Send the request as JSON.' })
      return
    }
  
    const ownerId = req.session.userId
  
    if (!ownerId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    const id = req.params.id
    const input = req.body
  
    if (typeof id !== 'string' || !uuidPattern.test(id)) {
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
        message: 'Provide the current version and a reason of 5–1000 characters.',
      })
      return
    }
  
    const version = input.version as number
    const reason = input.reason.trim() as string
  
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const owner = await tx.user.findUnique({
            where: { id: ownerId },
            select: { role: true, status: true },
          })
  
          if (!owner || owner.status !== 'ACTIVE') {
            throw new TransportRequestError(
              401,
              'Please sign in with an active account.',
            )
          }
  
          if (owner.role !== 'OWNER') {
            throw new TransportRequestError(
              403,
              'A pet-owner account is required.',
            )
          }
  
          const current = await tx.transportRequest.findFirst({
            where: { id, ownerId },
            select: {
              id: true,
              version: true,
              status: true,
              responseDueAt: true,
              confirmedPickupAt: true,
            },
          })
  
          if (!current) {
            throw new TransportRequestError(404, 'Request not found.')
          }
  
          if (current.version !== version) {
            throw new TransportRequestError(
              409,
              'This request changed. Refresh before cancelling.',
            )
          }
  
          if (
            current.status !== 'REQUESTED' &&
            current.status !== 'ACCEPTED'
          ) {
            throw new TransportRequestError(
              409,
              'This request can no longer be cancelled.',
            )
          }
  
          const now = new Date()
  
          const expired =
            current.status === 'REQUESTED' &&
            current.responseDueAt <= now
  
          if (
            current.status === 'ACCEPTED' &&
            (
              !current.confirmedPickupAt ||
              current.confirmedPickupAt <= now
            )
          ) {
            throw new TransportRequestError(
              409,
              'Online cancellation is closed at the confirmed pickup time. Contact the provider directly.',
            )
          }
  
          const status = expired ? 'EXPIRED' : 'CANCELLED'
  
          const updated = await tx.transportRequest.updateMany({
            where: {
              id,
              ownerId,
              version,
              status: current.status,
            },
            data: {
              status,
              cancelledAt: expired ? null : now,
              expiredAt: expired ? now : null,
              version: { increment: 1 },
            },
          })
  
          if (updated.count !== 1) {
            throw new TransportRequestError(
              409,
              'This request changed. Refresh and check its status.',
            )
          }
  
          await tx.transportRequestEvent.create({
            data: {
              transportRequestId: id,
              actorId: ownerId,
              version: version + 1,
              action: expired
                ? 'TRANSPORT_REQUEST_EXPIRED'
                : 'TRANSPORT_REQUEST_CANCELLED',
              previousStatus: current.status,
              newStatus: status,
              reason: expired
                ? 'The response deadline passed before the owner attempted cancellation.'
                : reason,
              details: {
                attemptedAction: 'CANCEL',
                confirmedPickupAt:
                  current.confirmedPickupAt?.toISOString() ?? null,
              },
            },
          })
  
          return {
            expired,
            request: { id, status, version: version + 1 },
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
  
      res.json({
        message: result.expired
          ? 'The response deadline had already passed. The request is now marked expired.'
          : 'Transport request cancelled.',
        request: result.request,
      })
    } catch (error) {
      if (error instanceof TransportRequestError) {
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
  })

  // GET /api/transport-requests/:id
transportRequestsRouter.get('/:id', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  const ownerId = req.session.userId

  if (!ownerId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const id = req.params.id

  if (typeof id !== 'string' || !uuidPattern.test(id)) {
    res.status(400).json({ message: 'Invalid request ID.' })
    return
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true, status: true },
    })

    if (!owner || owner.status !== 'ACTIVE') {
      res.status(401).json({
        message: 'Please sign in with an active account.',
      })
      return
    }

    if (owner.role !== 'OWNER') {
      res.status(403).json({
        message: 'A pet-owner account is required.',
      })
      return
    }

    const request = await prisma.transportRequest.findFirst({
      where: { id, ownerId },
      select: {
        id: true,
        ambulanceListingId: true,
        idempotencyKey: true,
        status: true,
        responseDueAt: true,
      },
    })

    if (!request) {
      res.status(404).json({ message: 'Transport request not found.' })
      return
    }

    const canStartAnother = [
      'DECLINED',
      'EXPIRED',
      'CANCELLED',
      'COMPLETED',
    ].includes(request.status)

    res.json({
      request,
      canStartAnother,
    })
  } catch (error) {
    next(error)
  }
})
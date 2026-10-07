import { Router } from 'express'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import type {} from './auth.js'
import { randomUUID } from 'node:crypto'

export const adminAmbulancesRouter = Router()

adminAmbulancesRouter.use(async (req, res, next) => {
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
      res.status(401).json({
        message: 'Please sign in with an active account.',
      })
      return
    }

    if (user.role !== 'ADMIN') {
      res.status(403).json({
        message: 'An administrator account is required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/ambulances?page=1
adminAmbulancesRouter.get('/', async (req, res, next) => {
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
    const [ambulances, total] = await prisma.$transaction(
      [
        prisma.ambulanceListing.findMany({
          orderBy: [
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          skip: (pageNumber - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            providerName: true,
            city: true,
            state: true,
            species: true,
            status: true,
            isDemo: true,
            verificationStatus: true,
            verificationNotes: true,
            verificationEvidenceReferences: true,
            availability: true,
            availabilityUpdatedAt: true,
            requestsEnabled: true,
            version: true,
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                status: true,
              },
            },
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
        }),
        prisma.ambulanceListing.count(),
      ],
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    )

    res.json({
      ambulances,
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    next(error)
  }
})
class AmbulanceAdminError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message)
    }
  }
  
  adminAmbulancesRouter.post('/', async (req, res, next) => {
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
  
    const allowedFields = [
      'providerName',
      'city',
      'state',
      'phone',
      'species',
      'isDemo',
      'reason',
    ]
  
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !allowedFields.includes(key))
    ) {
      res.status(400).json({
        message: 'Provide valid listing details.',
      })
      return
    }
  
    for (const field of [
      { key: 'providerName', min: 3, max: 180 },
      { key: 'city', min: 2, max: 100 },
      { key: 'state', min: 2, max: 100 },
      { key: 'reason', min: 5, max: 1000 },
    ]) {
      const value = input[field.key]
  
      if (
        typeof value !== 'string' ||
        value.length > field.max ||
        value.trim().length < field.min
      ) {
        res.status(400).json({
          message: `${field.key} must contain ${field.min}–${field.max} characters.`,
        })
        return
      }
    }
  
    if (
      typeof input.isDemo !== 'boolean' ||
      !Array.isArray(input.species) ||
      input.species.length < 1 ||
      input.species.length > 3 ||
      input.species.some(
        (value: unknown) =>
          typeof value !== 'string' ||
          !['CAT', 'DOG', 'TURTLE'].includes(value),
      ) ||
      new Set(input.species).size !== input.species.length
    ) {
      res.status(400).json({
        message: 'Choose a listing type and at least one supported species.',
      })
      return
    }
  
    if (
      input.phone !== undefined &&
      input.phone !== null &&
      (
        typeof input.phone !== 'string' ||
        input.phone.length > 30
      )
    ) {
      res.status(400).json({
        message: 'Phone must be text up to 30 characters.',
      })
      return
    }
  
    const providerName = input.providerName.trim()
    const city = input.city.trim().replace(/\s+/g, ' ')
    const state = input.state.trim().replace(/\s+/g, ' ')
    const reason = input.reason.trim()
    const isDemo = input.isDemo as boolean
    const species = input.species as ('CAT' | 'DOG' | 'TURTLE')[]
  
    const suppliedPhone =
      typeof input.phone === 'string'
        ? input.phone.replace(/[\s().-]/g, '')
        : ''
  
    if (isDemo && suppliedPhone) {
      res.status(400).json({
        message: 'Demo listings must not contain a real phone number.',
      })
      return
    }
  
    if (!isDemo && !/^\+?\d{7,15}$/.test(suppliedPhone)) {
      res.status(400).json({
        message: 'Enter a contact phone number with 7–15 digits.',
      })
      return
    }
  
    const actorId = req.session.userId
  
    if (!actorId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    try {
      const listing = await prisma.$transaction(async (tx) => {
        const admin = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true, status: true },
        })
  
        if (
          !admin ||
          admin.role !== 'ADMIN' ||
          admin.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            403,
            'An active administrator account is required.',
          )
        }
  
        const created = await tx.ambulanceListing.create({
          data: {
            slug: `transport-${randomUUID()}`,
            providerName,
            city,
            state,
            countryCode: 'IN',
            phone: isDemo ? null : suppliedPhone,
            species,
            isDemo,
            status: 'DRAFT',
            verificationStatus: 'NOT_SUBMITTED',
            availability: 'UNKNOWN',
            requestsEnabled: false,
            timeZone: 'Asia/Kolkata',
            serviceAreas: {
              create: {
                city,
                state,
                countryCode: 'IN',
                cityKey: city.toLowerCase(),
                stateKey: state.toLowerCase(),
              },
            },
          },
          select: {
            id: true,
            providerName: true,
            status: true,
            isDemo: true,
          },
        })
  
        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Administrator',
            action: 'AMBULANCE_LISTING_CREATED',
            entityType: 'AmbulanceListing',
            entityId: created.id,
            details: {
              reason,
              isDemo,
              initialCoverage: { city, state },
            },
          },
        })
  
        return created
      })
  
      res.status(201).json({
        message: 'Draft ambulance listing created.',
        listing,
      })
    } catch (error) {
      if (error instanceof AmbulanceAdminError) {
        res.status(error.statusCode).json({ message: error.message })
        return
      }
  
      next(error)
    }
  })
  adminAmbulancesRouter.post(
    '/:id/publication',
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
        res.status(400).json({ message: 'Invalid listing ID.' })
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
        !['PUBLISH_DEMO', 'PUBLISH_REAL', 'ARCHIVE'].includes(input.action) ||
        typeof input.reason !== 'string' ||
        input.reason.length > 1000 ||
        input.reason.trim().length < 5
      ) {
        res.status(400).json({
          message:
            'Provide the current version, a valid action, and a reason of 5–1000 characters.',
        })
        return
      }
  
      const actorId = req.session.userId
  
      if (!actorId) {
        res.status(401).json({ message: 'Please sign in.' })
        return
      }
  
      const version = input.version as number
      const action = input.action as
       | 'PUBLISH_DEMO'
       | 'PUBLISH_REAL'
       | 'ARCHIVE'

const publishing =
  action === 'PUBLISH_DEMO' || action === 'PUBLISH_REAL'
      const reason = input.reason.trim() as string
  
      try {
        const listing = await prisma.$transaction(async (tx) => {
          const admin = await tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, status: true },
          })
  
          if (
            !admin ||
            admin.role !== 'ADMIN' ||
            admin.status !== 'ACTIVE'
          ) {
            throw new AmbulanceAdminError(
              403,
              'An active administrator account is required.',
            )
          }
  
          const current = await tx.ambulanceListing.findUnique({
            where: { id },
            include: {
              serviceAreas: {
                select: { id: true },
              },
            },
          })
  
          if (!current) {
            throw new AmbulanceAdminError(404, 'Listing not found.')
          }
  
          if (current.version !== version) {
            throw new AmbulanceAdminError(
              409,
              'This listing has changed. Refresh before trying again.',
            )
          }
  
          if (action === 'PUBLISH_DEMO') {
            if (!current.isDemo) {
              throw new AmbulanceAdminError(
                409,
                'This action only publishes fictional demo listings.',
              )
            }
  
            if (
              current.status === 'PUBLISHED' ||
              current.verificationStatus === 'SUSPENDED'
            ) {
              throw new AmbulanceAdminError(
                409,
                'This listing is already published or is suspended.',
              )
            }
  
            if (
              current.species.length === 0 ||
              current.serviceAreas.length === 0 ||
              !current.providerName.trim() ||
              !current.city.trim() ||
              !current.state.trim()
            ) {
              throw new AmbulanceAdminError(
                409,
                'Add a provider name, base location, species, and service area before publishing.',
              )
            }
  
            if (current.phone || current.email || current.websiteUrl) {
              throw new AmbulanceAdminError(
                409,
                'Remove contact details before publishing a fictional demo.',
              )
            }
          } else if (action === 'PUBLISH_REAL') {
            if (current.isDemo) {
              throw new AmbulanceAdminError(
                409,
                'Use Publish demo for fictional listings.',
              )
            }

            if (current.status === 'PUBLISHED') {
              throw new AmbulanceAdminError(
                409,
                'This listing is already published.',
              )
            }

            if (
              current.verificationStatus !== 'APPROVED' ||
              !current.verificationReviewedAt ||
              !current.verificationReviewedById ||
              !current.verificationEvidenceReferences?.trim()
            ) {
              throw new AmbulanceAdminError(
                409,
                'Complete provider verification before publishing.',
              )
            }

            const phone = (current.phone ?? '').replace(/[\s().-]/g, '')

            if (
              current.countryCode !== 'IN' ||
              current.providerName.trim().length < 3 ||
              current.city.trim().length < 2 ||
              current.state.trim().length < 2 ||
              !/^\+?\d{7,15}$/.test(phone) ||
              current.species.length === 0 ||
              current.serviceAreas.length === 0
            ) {
              throw new AmbulanceAdminError(
                409,
                'The provider needs complete contact details, location, species, and service areas.',
              )
            }
          } else if (current.status === 'ARCHIVED') {
            throw new AmbulanceAdminError(
              409,
              'This listing is already archived.',
            )
          }
  
          
          const status = publishing ? 'PUBLISHED' : 'ARCHIVED'
  
          const updated = await tx.ambulanceListing.updateMany({
            where: {
              id,
              version,
            },
            data: {
              status,
              
              publishedAt: publishing ? new Date() : null,
              requestsEnabled: false,
              availability: 'UNKNOWN',
              availabilityUpdatedAt: null,
              version: { increment: 1 },
            },
          })
  
          if (updated.count !== 1) {
            throw new AmbulanceAdminError(
              409,
              'This listing changed. Refresh and check its status.',
            )
          }
  
          await tx.auditEvent.create({
            data: {
              actorId,
              actorLabel: 'Administrator',
              action:
              action === 'PUBLISH_DEMO'
                ? 'AMBULANCE_DEMO_PUBLISHED'
                : action === 'PUBLISH_REAL'
                  ? 'AMBULANCE_PROVIDER_PUBLISHED'
                  : 'AMBULANCE_LISTING_ARCHIVED',
              entityType: 'AmbulanceListing',
              entityId: id,
              details: {
                reason,
                previousStatus: current.status,
                newStatus: status,
                version: version + 1,
              },
            },
          })
  
          return { id, status, version: version + 1 }
        })
  
        res.json({
          message:
            action === 'PUBLISH_DEMO'
              ? 'Demo listing published. No real transport service is available.'
              : action === 'PUBLISH_REAL'
                ? 'Approved provider published. Transport requests remain disabled.'
                : 'Listing archived and removed from the public directory.',
          listing,
        })
      } catch (error) {
        if (error instanceof AmbulanceAdminError) {
          res.status(error.statusCode).json({ message: error.message })
          return
        }
  
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          res.status(409).json({
            message: 'This listing changed. Refresh and check its status.',
          })
          return
        }
  
        next(error)
      }
    },
  )
  // GET /api/admin/ambulances/:id
adminAmbulancesRouter.get('/:id', async (req, res, next) => {
    const id = req.params.id
  
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({
        message: 'Invalid listing ID.',
      })
      return
    }
  
    try {
      const listing = await prisma.ambulanceListing.findUnique({
        where: { id },
        select: {
          id: true,
          providerName: true,
          description: true,
          species: true,
          animalRestrictions: true,
          city: true,
          state: true,
          countryCode: true,
          phone: true,
          email: true,
          websiteUrl: true,
          openingHours: true,
          timeZone: true,
          status: true,
          isDemo: true,
          verificationStatus: true,
          requestsEnabled: true,
          version: true,
          serviceAreas: {
            orderBy: [
              { state: 'asc' },
              { city: 'asc' },
            ],
            select: {
              city: true,
              state: true,
              countryCode: true,
            },
          },
        },
      })
  
      if (!listing) {
        res.status(404).json({
          message: 'Ambulance listing not found.',
        })
        return
      }
  
      res.json({ listing })
    } catch (error) {
      next(error)
    }
  })
  adminAmbulancesRouter.put('/:id', async (req, res, next) => {
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
      res.status(400).json({ message: 'Invalid listing ID.' })
      return
    }
  
    const allowedFields = [
      'version',
      'providerName',
      'description',
      'animalRestrictions',
      'city',
      'state',
      'phone',
      'openingHours',
      'species',
      'serviceAreas',
      'reason',
    ]
  
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !allowedFields.includes(key)) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647
    ) {
      res.status(400).json({
        message: 'Provide valid listing details and the current version.',
      })
      return
    }
  
    try {
      function textField(key: string, min: number, max: number) {
        const value = input[key]
  
        if (
          typeof value !== 'string' ||
          value.length > max ||
          value.trim().length < min
        ) {
          throw new AmbulanceAdminError(
            400,
            `${key} must contain ${min}–${max} characters.`,
          )
        }
  
        return value.trim()
      }
  
      const providerName = textField('providerName', 3, 180)
      const description = textField('description', 0, 5000)
      const animalRestrictions = textField('animalRestrictions', 0, 1000)
      const city = textField('city', 2, 100).replace(/\s+/g, ' ')
      const state = textField('state', 2, 100).replace(/\s+/g, ' ')
      const phone = textField('phone', 0, 30).replace(/[\s().-]/g, '')
      const openingHours = textField('openingHours', 0, 1000)
      const reason = textField('reason', 5, 1000)
  
      if (
        !Array.isArray(input.species) ||
        input.species.length < 1 ||
        input.species.length > 3 ||
        input.species.some(
          (value: unknown) =>
            typeof value !== 'string' ||
            !['CAT', 'DOG', 'TURTLE'].includes(value),
        ) ||
        new Set(input.species).size !== input.species.length
      ) {
        throw new AmbulanceAdminError(
          400,
          'Choose at least one supported species without duplicates.',
        )
      }
  
      const species = input.species as ('CAT' | 'DOG' | 'TURTLE')[]
  
      if (
        !Array.isArray(input.serviceAreas) ||
        input.serviceAreas.length < 1 ||
        input.serviceAreas.length > 30
      ) {
        throw new AmbulanceAdminError(
          400,
          'Provide between 1 and 30 service areas.',
        )
      }
  
      const serviceAreas: {
        city: string
        state: string
        countryCode: string
        cityKey: string
        stateKey: string
      }[] = []
  
      const seen = new Set<string>()
  
      for (const area of input.serviceAreas) {
        if (
          !area ||
          typeof area !== 'object' ||
          Array.isArray(area) ||
          Object.keys(area).some(
            (key) => !['city', 'state'].includes(key),
          ) ||
          typeof area.city !== 'string' ||
          typeof area.state !== 'string' ||
          area.city.length > 100 ||
          area.state.length > 100 ||
          area.city.trim().length < 2 ||
          area.state.trim().length < 2
        ) {
          throw new AmbulanceAdminError(
            400,
            'Each service area needs a city and state of 2–100 characters.',
          )
        }
  
        const areaCity = area.city.trim().replace(/\s+/g, ' ')
        const areaState = area.state.trim().replace(/\s+/g, ' ')
        const cityKey = areaCity.toLowerCase()
        const stateKey = areaState.toLowerCase()
        const key = JSON.stringify([stateKey, cityKey])
  
        if (seen.has(key)) {
          throw new AmbulanceAdminError(
            400,
            'Remove duplicate service areas.',
          )
        }
  
        seen.add(key)
        serviceAreas.push({
          city: areaCity,
          state: areaState,
          countryCode: 'IN',
          cityKey,
          stateKey,
        })
      }
  
      const actorId = req.session.userId
  
      if (!actorId) {
        throw new AmbulanceAdminError(401, 'Please sign in.')
      }
  
      const listing = await prisma.$transaction(async (tx) => {
        const admin = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true, status: true },
        })
  
        if (
          !admin ||
          admin.role !== 'ADMIN' ||
          admin.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            403,
            'An active administrator account is required.',
          )
        }
  
        const current = await tx.ambulanceListing.findUnique({
          where: { id },
          select: {
            version: true,
            status: true,
            isDemo: true,
            countryCode: true,
            verificationStatus: true,
          },
        })
  
        if (!current) {
          throw new AmbulanceAdminError(404, 'Listing not found.')
        }
  
        if (current.version !== input.version) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Reload before saving again.',
          )
        }
  
        if (current.status === 'PUBLISHED') {
          throw new AmbulanceAdminError(
            409,
            'Archive the published listing before editing it.',
          )
        }
  
        if (
          current.verificationStatus === 'SUSPENDED' ||
          (
            !current.isDemo &&
            !['NOT_SUBMITTED', 'REJECTED'].includes(
              current.verificationStatus,
            )
          )
        ) {
          throw new AmbulanceAdminError(
            409,
            'This listing is locked by its verification status.',
          )
        }
  
        if (current.countryCode !== 'IN') {
          throw new AmbulanceAdminError(
            409,
            'This editor currently supports Indian service areas only.',
          )
        }
  
        if (current.isDemo && phone) {
          throw new AmbulanceAdminError(
            400,
            'Demo listings must not contain a phone number.',
          )
        }
  
        if (!current.isDemo && !/^\+?\d{7,15}$/.test(phone)) {
          throw new AmbulanceAdminError(
            400,
            'Enter a provider phone number with 7–15 digits.',
          )
        }
  
        const updated = await tx.ambulanceListing.updateMany({
          where: {
            id,
            version: input.version,
            status: current.status,
            verificationStatus: current.verificationStatus,
          },
          data: {
            providerName,
            description: description || null,
            animalRestrictions: animalRestrictions || null,
            city,
            state,
            phone: current.isDemo ? null : phone,
            openingHours: openingHours || null,
            species,
            requestsEnabled: false,
            availability: 'UNKNOWN',
            availabilityUpdatedAt: null,
            version: { increment: 1 },
          },
        })
  
        if (updated.count !== 1) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Reload before saving again.',
          )
        }
  
        await tx.ambulanceServiceArea.deleteMany({
          where: { ambulanceListingId: id },
        })
  
        await tx.ambulanceServiceArea.createMany({
          data: serviceAreas.map((area) => ({
            ambulanceListingId: id,
            ...area,
          })),
        })
  
        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Administrator',
            action: 'AMBULANCE_LISTING_UPDATED',
            entityType: 'AmbulanceListing',
            entityId: id,
            details: {
              reason,
              version: input.version + 1,
              status: current.status,
              serviceAreas: serviceAreas.map((area) => ({
                city: area.city,
                state: area.state,
              })),
            },
          },
        })
  
        return {
          id,
          version: input.version + 1,
          status: current.status,
        }
      })
  
      res.json({
        message: 'Listing details saved. Publication status is unchanged.',
        listing,
      })
    } catch (error) {
      if (error instanceof AmbulanceAdminError) {
        res.status(error.statusCode).json({ message: error.message })
        return
      }
  
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        res.status(409).json({
          message: 'This listing changed. Reload and check its details.',
        })
        return
      }
  
      next(error)
    }
  })
  adminAmbulancesRouter.post('/:id/verification', async (req, res, next) => {
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
  
    const id = req.params.id
    const input = req.body
  
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      res.status(400).json({ message: 'Invalid listing ID.' })
      return
    }
  
    const transitions = {
      SUBMIT: 'SUBMITTED',
      START_REVIEW: 'UNDER_REVIEW',
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      SUSPEND: 'SUSPENDED',
      REOPEN: 'NOT_SUBMITTED',
    } as const
  
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['version', 'action', 'reason', 'evidence'].includes(key),
      ) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      input.version >= 2147483647 ||
      typeof input.action !== 'string' ||
      !Object.prototype.hasOwnProperty.call(transitions, input.action) ||
      typeof input.reason !== 'string' ||
      input.reason.trim().length < 5 ||
      input.reason.length > 1000 ||
      typeof input.evidence !== 'string' ||
      input.evidence.length > 5000
    ) {
      res.status(400).json({
        message: 'Provide a valid action, version, reason, and evidence text.',
      })
      return
    }
  
    const action = input.action as keyof typeof transitions
    const version = input.version as number
    const reason = input.reason.trim() as string
    const evidence = input.evidence.trim() as string
    const verificationStatus = transitions[action]
  
    if (
      (action === 'SUBMIT' || action === 'APPROVE') &&
      evidence.length < 10
    ) {
      res.status(400).json({
        message: 'Provide evidence references of 10–5000 characters.',
      })
      return
    }
  
    const actorId = req.session.userId
  
    if (!actorId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    try {
      const listing = await prisma.$transaction(async (tx) => {
        const admin = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true, status: true },
        })
  
        if (
          !admin ||
          admin.role !== 'ADMIN' ||
          admin.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            403,
            'An active administrator account is required.',
          )
        }
  
        const current = await tx.ambulanceListing.findUnique({
          where: { id },
          include: {
            serviceAreas: true,
          },
        })
  
        if (!current) {
          throw new AmbulanceAdminError(404, 'Listing not found.')
        }
  
        if (current.version !== version) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh before trying again.',
          )
        }
  
        if (current.isDemo) {
          throw new AmbulanceAdminError(
            409,
            'Fictional demos cannot receive real-provider verification.',
          )
        }
  
        if (
          current.status === 'PUBLISHED' &&
          action !== 'SUSPEND'
        ) {
          throw new AmbulanceAdminError(
            409,
            'Archive this listing before changing verification.',
          )
        }
  
        const allowed =
        (action === 'SUBMIT' &&
          ['NOT_SUBMITTED', 'REJECTED'].includes(
            current.verificationStatus,
          )) ||
        (action === 'START_REVIEW' &&
          current.verificationStatus === 'SUBMITTED') ||
        ((action === 'APPROVE' || action === 'REJECT') &&
          current.verificationStatus === 'UNDER_REVIEW') ||
        (action === 'SUSPEND' &&
          current.verificationStatus === 'APPROVED') ||
        (action === 'REOPEN' &&
          current.verificationStatus === 'SUSPENDED')
  
        if (!allowed) {
          throw new AmbulanceAdminError(
            409,
            'This action is not allowed in the current verification state.',
          )
        }
  
        if (action === 'SUBMIT' || action === 'APPROVE') {
          const phone = (current.phone ?? '').replace(/[\s().-]/g, '')
  
          if (
            current.countryCode !== 'IN' ||
            current.providerName.trim().length < 3 ||
            current.city.trim().length < 2 ||
            current.state.trim().length < 2 ||
            !/^\+?\d{7,15}$/.test(phone) ||
            current.species.length === 0 ||
            current.serviceAreas.length === 0 ||
            current.serviceAreas.some(
              (area) =>
                area.countryCode !== 'IN' ||
                area.city.trim().length < 2 ||
                area.state.trim().length < 2,
            )
          ) {
            throw new AmbulanceAdminError(
              409,
              'Complete the provider name, Indian location, phone, species, and service areas first.',
            )
          }
        }
  
        const now = new Date()
        const finalDecision =
          action === 'APPROVE' ||
          action === 'REJECT' ||
          action === 'SUSPEND'
  
          const nextStatus =
          action === 'SUSPEND'
            ? 'ARCHIVED'
            : action === 'REOPEN'
              ? 'DRAFT'
              : current.status
  
        const updated = await tx.ambulanceListing.updateMany({
          where: {
            id,
            version,
            isDemo: false,
            status: current.status,
            verificationStatus: current.verificationStatus,
          },
          data: {
            verificationStatus,
            status: nextStatus,
            publishedAt:
              action === 'SUSPEND' || action === 'REOPEN'
                ? null
                : current.publishedAt,
            verificationSubmittedAt:
              action === 'REOPEN'
                ? null
                : action === 'SUBMIT'
                  ? now
                  : current.verificationSubmittedAt,
            verificationReviewedAt: finalDecision ? now : null,
            verificationReviewedById: finalDecision ? actorId : null,
            verificationNotes: reason,
            verificationEvidenceReferences:
              action === 'REOPEN'
                ? null
                : action === 'SUBMIT' || action === 'APPROVE'
                  ? evidence
                  : current.verificationEvidenceReferences,
            requestsEnabled: false,
            availability: 'UNKNOWN',
            availabilityUpdatedAt: null,
            version: { increment: 1 },
          },
        })
  
        if (updated.count !== 1) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh and check its verification.',
          )
        }
  
        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Administrator',
            action: `AMBULANCE_VERIFICATION_${action}`,
            entityType: 'AmbulanceListing',
            entityId: id,
            details: {
              reason,
              evidence:
                action === 'SUBMIT' || action === 'APPROVE'
                  ? evidence
                  : null,
                  previousVerificationStatus: current.verificationStatus,
                  newVerificationStatus: verificationStatus,
                  previousPublicationStatus: current.status,
                  newPublicationStatus: nextStatus,
              version: version + 1,
            },
          },
        })
  
        return {
          id,
          version: version + 1,
          verificationStatus,
          status: nextStatus,
        }
      })
  
      res.json({
        message:
          action === 'SUSPEND'
            ? 'Provider suspended and archived. Transport requests are disabled.'
            : action === 'REOPEN'
              ? 'Provider returned to draft. A fresh verification review is required.'
              : 'Verification updated. Publication status is unchanged.',
        listing,
      })
    } catch (error) {
      if (error instanceof AmbulanceAdminError) {
        res.status(error.statusCode).json({ message: error.message })
        return
      }
  
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        res.status(409).json({
          message: 'This listing changed. Refresh before trying again.',
        })
        return
      }
  
      next(error)
    }
  })
  // GET /api/admin/ambulances/:id/history
adminAmbulancesRouter.get('/:id/history', async (req, res, next) => {
  const id = req.params.id

  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({ message: 'Invalid listing ID.' })
    return
  }

  try {
    const listing = await prisma.ambulanceListing.findUnique({
      where: { id },
      select: { id: true, providerName: true },
    })

    if (!listing) {
      res.status(404).json({ message: 'Listing not found.' })
      return
    }

    const events = await prisma.auditEvent.findMany({
      where: {
        entityType: 'AmbulanceListing',
        entityId: id,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 101,
      select: {
        id: true,
        actorId: true,
        actorLabel: true,
        action: true,
        details: true,
        createdAt: true,
      },
    })

    res.json({
      listing,
      events: events.slice(0, 100),
      hasMore: events.length > 100,
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/ambulances/:id/link-account
adminAmbulancesRouter.post('/:id/link-account', async (req, res, next) => {
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

  const id = req.params.id
  const input = req.body

  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({ message: 'Invalid listing ID.' })
    return
  }

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['version', 'email', 'reason'].includes(key),
    ) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    input.version >= 2147483647 ||
    typeof input.email !== 'string' ||
    input.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 5 ||
    input.reason.length > 1000
  ) {
    res.status(400).json({
      message: 'Provide the current version, a valid email, and a reason of 5–1000 characters.',
    })
    return
  }

  const actorId = req.session.userId

  if (!actorId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const version = input.version as number
  const email = input.email.trim().toLowerCase() as string
  const reason = input.reason.trim() as string

  try {
    const listing = await prisma.$transaction(
      async (tx) => {
        const admin = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true, status: true },
        })

        if (
          !admin ||
          admin.role !== 'ADMIN' ||
          admin.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            403,
            'An active administrator account is required.',
          )
        }

        const current = await tx.ambulanceListing.findUnique({
          where: { id },
          select: {
            id: true,
            version: true,
            isDemo: true,
            userId: true,
            status: true,
            verificationStatus: true,
          },
        })

        if (!current) {
          throw new AmbulanceAdminError(404, 'Listing not found.')
        }

        if (current.version !== version) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh before trying again.',
          )
        }

        if (current.isDemo) {
          throw new AmbulanceAdminError(
            409,
            'This action is only available for real providers.',
          )
        }

        if (current.userId) {
          throw new AmbulanceAdminError(
            409,
            'This listing already has a linked account.',
          )
        }

        if (current.status === 'PUBLISHED') {
          throw new AmbulanceAdminError(
            409,
            'Archive the listing before linking an account.',
          )
        }

        if (
          !['NOT_SUBMITTED', 'REJECTED', 'APPROVED'].includes(
            current.verificationStatus,
          )
        ) {
          throw new AmbulanceAdminError(
            409,
            'Finish the current review, or return a suspended listing to draft, before linking.',
          )
        }

        const provider = await tx.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
          },
        })

        if (
          !provider ||
          provider.role !== 'AMBULANCE_PROVIDER' ||
          provider.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            400,
            'That email must belong to an existing active AMBULANCE_PROVIDER account.',
          )
        }

        const existingLink = await tx.ambulanceListing.findUnique({
          where: { userId: provider.id },
          select: { id: true },
        })

        if (existingLink) {
          throw new AmbulanceAdminError(
            409,
            'This account is already linked to another ambulance listing.',
          )
        }

        const updated = await tx.ambulanceListing.updateMany({
          where: {
            id,
            version,
            userId: null,
            isDemo: false,
            status: current.status,
            verificationStatus: current.verificationStatus,
          },
          data: {
            userId: provider.id,
            status: 'DRAFT',
            publishedAt: null,
            verificationStatus: 'NOT_SUBMITTED',
            verificationSubmittedAt: null,
            verificationReviewedAt: null,
            verificationReviewedById: null,
            verificationNotes: reason,
            verificationEvidenceReferences: null,
            requestsEnabled: false,
            availability: 'UNKNOWN',
            availabilityUpdatedAt: null,
            version: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh before trying again.',
          )
        }

        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Administrator',
            action: 'AMBULANCE_ACCOUNT_LINKED',
            entityType: 'AmbulanceListing',
            entityId: id,
            details: {
              reason,
              previousUserId: current.userId,
              newUserId: provider.id,
              previousPublicationStatus: current.status,
              newPublicationStatus: 'DRAFT',
              previousVerificationStatus: current.verificationStatus,
              newVerificationStatus: 'NOT_SUBMITTED',
              version: version + 1,
            },
          },
        })

        return {
          id,
          version: version + 1,
          status: 'DRAFT',
          verificationStatus: 'NOT_SUBMITTED',
          user: provider,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    )

    res.json({
      message: 'Provider account linked. Submit the draft for a fresh review.',
      listing,
    })
  } catch (error) {
    if (error instanceof AmbulanceAdminError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      res.status(409).json({
        message: 'The listing or account changed. Refresh and check the linked account before trying again.',
      })
      return
    }

    next(error)
  }
})

// POST /api/admin/ambulances/:id/requests
adminAmbulancesRouter.post('/:id/requests', async (req, res, next) => {
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

  const id = req.params.id
  const input = req.body

  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({ message: 'Invalid listing ID.' })
    return
  }

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['version', 'enabled', 'reason'].includes(key),
    ) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    input.version >= 2147483647 ||
    typeof input.enabled !== 'boolean' ||
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 5 ||
    input.reason.length > 1000
  ) {
    res.status(400).json({
      message:
        'Provide the current version, an enabled setting, and a reason of 5–1000 characters.',
    })
    return
  }

  const actorId = req.session.userId

  if (!actorId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const version = input.version as number
  const enabled = input.enabled as boolean
  const reason = input.reason.trim() as string

  try {
    const listing = await prisma.$transaction(
      async (tx) => {
        const admin = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true, status: true },
        })

        if (
          !admin ||
          admin.role !== 'ADMIN' ||
          admin.status !== 'ACTIVE'
        ) {
          throw new AmbulanceAdminError(
            403,
            'An active administrator account is required.',
          )
        }

        const current = await tx.ambulanceListing.findUnique({
          where: { id },
          include: {
            user: {
              select: { role: true, status: true },
            },
            serviceAreas: {
              select: {
                city: true,
                state: true,
                countryCode: true,
              },
            },
          },
        })

        if (!current) {
          throw new AmbulanceAdminError(404, 'Listing not found.')
        }

        if (current.version !== version) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh before trying again.',
          )
        }

        if (current.requestsEnabled === enabled) {
          throw new AmbulanceAdminError(
            409,
            enabled
              ? 'Transport requests are already enabled.'
              : 'Transport requests are already disabled.',
          )
        }

        if (enabled) {
          const now = new Date()
          const phone = (current.phone ?? '').replace(/[\s().-]/g, '')

          if (
            current.isDemo ||
            current.status !== 'PUBLISHED' ||
            !current.publishedAt ||
            current.publishedAt > now ||
            current.verificationStatus !== 'APPROVED' ||
            !current.verificationReviewedAt ||
            current.verificationReviewedAt > now ||
            !current.verificationReviewedById ||
            !current.verificationEvidenceReferences?.trim() ||
            current.user?.role !== 'AMBULANCE_PROVIDER' ||
            current.user.status !== 'ACTIVE'
          ) {
            throw new AmbulanceAdminError(
              409,
              'Requests require an approved, published real provider with an active linked provider account.',
            )
          }

          if (
            current.countryCode !== 'IN' ||
            current.providerName.trim().length < 3 ||
            current.city.trim().length < 2 ||
            current.state.trim().length < 2 ||
            !/^\+?\d{7,15}$/.test(phone) ||
            current.species.length === 0 ||
            current.serviceAreas.length === 0 ||
            current.serviceAreas.some(
              (area) =>
                area.countryCode !== 'IN' ||
                area.city.trim().length < 2 ||
                area.state.trim().length < 2,
            )
          ) {
            throw new AmbulanceAdminError(
              409,
              'Complete the provider contact details, supported species, and Indian service areas first.',
            )
          }
        }

        const updated = await tx.ambulanceListing.updateMany({
          where: {
            id,
            version,
            requestsEnabled: current.requestsEnabled,
          },
          data: {
            requestsEnabled: enabled,
            version: { increment: 1 },
          },
        })

        if (updated.count !== 1) {
          throw new AmbulanceAdminError(
            409,
            'This listing changed. Refresh before trying again.',
          )
        }

        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Administrator',
            action: enabled
              ? 'AMBULANCE_REQUESTS_ENABLED'
              : 'AMBULANCE_REQUESTS_DISABLED',
            entityType: 'AmbulanceListing',
            entityId: id,
            details: {
              reason,
              previousRequestsEnabled: current.requestsEnabled,
              newRequestsEnabled: enabled,
              version: version + 1,
            },
          },
        })

        return {
          id,
          version: version + 1,
          requestsEnabled: enabled,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    )

    res.json({
      message: enabled
        ? 'Transport requests enabled. Recent provider availability is still required.'
        : 'New transport requests disabled. Existing requests are unchanged.',
      listing,
    })
  } catch (error) {
    if (error instanceof AmbulanceAdminError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      res.status(409).json({
        message: 'This listing changed. Refresh and check its request setting.',
      })
      return
    }

    next(error)
  }
})
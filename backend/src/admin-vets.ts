import { Router } from 'express'
import { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import type {} from './auth.js'
import * as argon2 from 'argon2'
import { rateLimit } from 'express-rate-limit'

export const adminVetsRouter = Router()

class RequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

const actions = [
  'SUBMIT',
  'START_REVIEW',
  'APPROVE',
  'REJECT',
  'SUSPEND',
  'PUBLISH',
  'RETURN_TO_DRAFT',
  'ARCHIVE',
] as const

type VetAction = (typeof actions)[number]

function validAction(value: unknown): value is VetAction {
  return (
    typeof value === 'string' &&
    actions.some((action) => action === value)
  )
}

// Check the current account status and role on every request.
adminVetsRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (!req.session.userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
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

    if (user.role !== 'ADMIN') {
      res.status(403).json({
        message: 'Administrator access is required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// Protect requests that change data.
adminVetsRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
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
  }

  next()
})

// GET /api/admin/vets?page=1
adminVetsRouter.get('/', async (req, res, next) => {
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
  const pageSize = 20

  try {
    const [vets, total] = await prisma.$transaction([
      prisma.vetListing.findMany({
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          vetName: true,
          clinicName: true,
          city: true,
          state: true,
          species: true,
          status: true,
          isDemo: true,
          verificationStatus: true,
          verificationSubmittedAt: true,
          verificationReviewedAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              status: true,
            },
          },
        },
      }),
      prisma.vetListing.count(),
    ])

    res.json({
      vets,
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/vets/:id
// Internal verification fields are available only to admins.
adminVetsRouter.get('/:id', async (req, res, next) => {
  const id = req.params.id

  if (!validId(id)) {
    res.status(400).json({
      message: 'Invalid vet listing ID.',
    })
    return
  }

  try {
    const vet = await prisma.vetListing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        verificationReviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!vet) {
      res.status(404).json({
        message: 'Vet listing not found.',
      })
      return
    }

    res.json({ vet })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/vets/:id/transition
adminVetsRouter.post('/:id/transition', async (req, res, next) => {
  const id = req.params.id
  const input = req.body ?? {}

  if (!validId(id)) {
    res.status(400).json({
      message: 'Invalid vet listing ID.',
    })
    return
  }

  if (!validAction(input.action)) {
    res.status(400).json({
      message: 'Choose a valid vet listing action.',
    })
    return
  }

  if (
    typeof input.updatedAt !== 'string' ||
    Number.isNaN(new Date(input.updatedAt).getTime())
  ) {
    res.status(400).json({
      message: 'Provide the current listing version. Reload it first.',
    })
    return
  }

  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 5 ||
    input.reason.trim().length > 2000
  ) {
    res.status(400).json({
      message: 'Provide a reason containing 5–2,000 characters.',
    })
    return
  }

  const action = input.action
  const version = new Date(input.updatedAt)
  const reason = input.reason.trim()
  let evidenceReferences = ''

  if (action === 'APPROVE') {
    if (input.verificationConfirmed !== true) {
      res.status(400).json({
        message:
          'Confirm that identity, credentials, contact details, location, and supported species were checked.',
      })
      return
    }

    if (
      typeof input.evidenceReferences !== 'string' ||
      input.evidenceReferences.trim().length < 10 ||
      input.evidenceReferences.trim().length > 5000
    ) {
      res.status(400).json({
        message:
          'Provide internal evidence references containing 10–5,000 characters.',
      })
      return
    }

    evidenceReferences = input.evidenceReferences.trim()
  }

  const actorId = req.session.userId

  if (!actorId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  try {
    const vet = await prisma.$transaction(async (tx) => {
      const listing = await tx.vetListing.findUnique({
        where: { id },
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

      if (!listing) {
        throw new RequestError(404, 'Vet listing not found.')
      }

      const existing = listing

      if (existing.updatedAt.getTime() !== version.getTime()) {
        throw new RequestError(
          409,
          'This listing has changed. Reload it before continuing.',
        )
      }

      const now = new Date()

      const changes: Prisma.VetListingUncheckedUpdateManyInput = {
        updatedAt: new Date(
          Math.max(now.getTime(), existing.updatedAt.getTime() + 1),
        ),
      }

      function requireActiveProvider() {
        if (
          !existing.user ||
          existing.user.role !== 'VET' ||
          existing.user.status !== 'ACTIVE'
        ) {
          throw new RequestError(
            400,
            'Link this listing to an active VET account first.',
          )
        }
      }

      function requireListingDetails() {
        if (
          !existing.vetName.trim() ||
          !existing.clinicName.trim() ||
          !existing.addressLine1.trim() ||
          !existing.city.trim() ||
          !existing.state.trim() ||
          existing.species.length === 0
        ) {
          throw new RequestError(
            400,
            'Complete the name, clinic, location, and supported species first.',
          )
        }

        if (!existing.isDemo) {
          if (
            !existing.qualifications?.trim() ||
            !existing.registrationNumber?.trim() ||
            !existing.registrationBody?.trim() ||
            (!existing.phone?.trim() && !existing.email?.trim()) ||
            !existing.openingHours?.trim()
          ) {
            throw new RequestError(
              400,
              'Complete qualifications, registration details, contact information, and opening hours first.',
            )
          }
        }
      }

      const verificationAction = [
        'SUBMIT',
        'START_REVIEW',
        'APPROVE',
        'REJECT',
        'SUSPEND',
      ].includes(action)

      if (verificationAction && existing.isDemo) {
        throw new RequestError(
          400,
          'Demo listings cannot undergo real provider verification. They can be published, returned to draft, or archived.',
        )
      }

      if (
        verificationAction &&
        action !== 'SUSPEND' &&
        existing.status === 'ARCHIVED'
      ) {
        throw new RequestError(
          409,
          'Return this archived listing to draft before reviewing it.',
        )
      }

      switch (action) {
        case 'SUBMIT': {
          if (
            existing.verificationStatus !== 'NOT_SUBMITTED' &&
            existing.verificationStatus !== 'REJECTED' &&
            existing.verificationStatus !== 'SUSPENDED'
          ) {
            throw new RequestError(
              409,
              'This listing cannot be submitted from its current state.',
            )
          }

          requireActiveProvider()
          requireListingDetails()

          changes.verificationStatus = 'SUBMITTED'
          changes.verificationSubmittedAt = now
          changes.verificationReviewedAt = null
          changes.verificationReviewedById = null
          changes.verificationNotes = reason
          changes.verificationEvidenceReferences = null
          changes.status = 'DRAFT'
          changes.publishedAt = null
          break
        }

        case 'START_REVIEW': {
          if (existing.verificationStatus !== 'SUBMITTED') {
            throw new RequestError(
              409,
              'Only submitted listings can enter review.',
            )
          }

          requireActiveProvider()

          changes.verificationStatus = 'UNDER_REVIEW'
          changes.verificationNotes = reason
          break
        }

        case 'APPROVE': {
          if (existing.verificationStatus !== 'UNDER_REVIEW') {
            throw new RequestError(
              409,
              'The listing must be under review before approval.',
            )
          }

          requireActiveProvider()
          requireListingDetails()

          if (existing.userId === actorId) {
            throw new RequestError(
              403,
              'You cannot approve your own listing.',
            )
          }

          changes.verificationStatus = 'APPROVED'
          changes.verificationReviewedAt = now
          changes.verificationReviewedById = actorId
          changes.verificationNotes = reason
          changes.verificationEvidenceReferences = evidenceReferences
          changes.lastConfirmedAt = now
          changes.status = 'DRAFT'
          changes.publishedAt = null
          break
        }

        case 'REJECT': {
          if (existing.verificationStatus !== 'UNDER_REVIEW') {
            throw new RequestError(
              409,
              'Only listings under review can be rejected.',
            )
          }

          changes.verificationStatus = 'REJECTED'
          changes.verificationReviewedAt = now
          changes.verificationReviewedById = actorId
          changes.verificationNotes = reason
          changes.status = 'DRAFT'
          changes.publishedAt = null
          break
        }

        case 'SUSPEND': {
          if (existing.verificationStatus !== 'APPROVED') {
            throw new RequestError(
              409,
              'Only approved listings can be suspended.',
            )
          }

          changes.verificationStatus = 'SUSPENDED'
          changes.verificationReviewedAt = now
          changes.verificationReviewedById = actorId
          changes.verificationNotes = reason
          changes.status = 'DRAFT'
          changes.publishedAt = null
          break
        }

        case 'PUBLISH': {
          if (existing.status !== 'DRAFT') {
            throw new RequestError(
              409,
              'Only draft listings can be published.',
            )
          }

          if (existing.verificationStatus === 'SUSPENDED') {
            throw new RequestError(
              409,
              'Suspended listings cannot be published.',
            )
          }

          requireListingDetails()

          if (!existing.isDemo) {
            requireActiveProvider()

            if (
              existing.verificationStatus !== 'APPROVED' ||
              !existing.verificationReviewedAt ||
              existing.verificationReviewedAt > now ||
              !existing.verificationReviewedById ||
              !existing.verificationEvidenceReferences?.trim()
            ) {
              throw new RequestError(
                400,
                'Complete provider verification before publishing.',
              )
            }
          }

          changes.status = 'PUBLISHED'
          changes.publishedAt = now
          break
        }

        case 'RETURN_TO_DRAFT': {
          if (existing.status === 'DRAFT') {
            throw new RequestError(
              409,
              'This listing is already a draft.',
            )
          }

          changes.status = 'DRAFT'
          changes.publishedAt = null
          break
        }

        case 'ARCHIVE': {
          if (existing.status === 'ARCHIVED') {
            throw new RequestError(
              409,
              'This listing is already archived.',
            )
          }

          changes.status = 'ARCHIVED'
          changes.publishedAt = null
          break
        }
      }

      const result = await tx.vetListing.updateMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
          status: existing.status,
          verificationStatus: existing.verificationStatus,
        },
        data: changes,
      })

      if (result.count !== 1) {
        throw new RequestError(
          409,
          'This listing changed during the request. Reload it.',
        )
      }

      const updated = await tx.vetListing.findUniqueOrThrow({
        where: { id },
      })

      await tx.auditEvent.create({
        data: {
          actorId,
          actorLabel: 'Authenticated administrator',
          action: `VET_LISTING_${action}`,
          entityType: 'VetListing',
          entityId: id,
          details: {
            reason,
            previousStatus: existing.status,
            newStatus: updated.status,
            previousVerificationStatus: existing.verificationStatus,
            newVerificationStatus: updated.verificationStatus,
            previousVersion: existing.updatedAt.toISOString(),
            isDemo: existing.isDemo,
            ...(action === 'APPROVE'
              ? {
                  verificationConfirmed: true,
                  evidenceReferences,
                }
              : {}),
          },
        },
      })

      return updated
    })

    res.json({
      message: 'Vet listing updated successfully.',
      vet,
    })
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(error.statusCode).json({
        message: error.message,
      })
      return
    }

    next(error)
  }
})

const providerAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message:
      'Too many provider account creation attempts. Please try again later.',
  },
})

// POST /api/admin/vets/provider-accounts
adminVetsRouter.post(
  '/provider-accounts',
  providerAccountLimiter,
  async (req, res, next) => {
    const input = req.body

    if (
      !input ||
      typeof input.name !== 'string' ||
      typeof input.email !== 'string' ||
      typeof input.password !== 'string'
    ) {
      res.status(400).json({
        message: 'Name, email, and password are required.',
      })
      return
    }

    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const password = input.password

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({
        message: 'Name must contain 2–100 characters.',
      })
      return
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      res.status(400).json({
        message: 'Enter a valid email address.',
      })
      return
    }

    if (password.length < 15 || password.length > 128) {
      res.status(400).json({
        message: 'Password must contain 15–128 characters.',
      })
      return
    }

    const actorId = req.session.userId

    if (!actorId) {
      res.status(401).json({
        message: 'Please sign in.',
      })
      return
    }

    try {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      })

      const user = await prisma.$transaction(async (tx) => {
        const administrator = await tx.user.findUnique({
          where: { id: actorId },
          select: {
            role: true,
            status: true,
          },
        })

        if (
          !administrator ||
          administrator.role !== 'ADMIN' ||
          administrator.status !== 'ACTIVE'
        ) {
          throw new RequestError(
            403,
            'Active administrator access is required.',
          )
        }

        const created = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: 'VET',
            status: 'ACTIVE',
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        })

        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Authenticated administrator',
            action: 'VET_ACCOUNT_CREATED',
            entityType: 'User',
            entityId: created.id,
            details: {
              role: created.role,
              status: created.status,
            },
          },
        })

        return created
      })

      res.status(201).json({
        message:
          'Vet account created. Provider verification and listing publication are still required.',
        user,
      })
    } catch (error) {
      if (error instanceof RequestError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          message:
            'An account with this email already exists. Use a separate provider email; the existing account has not been changed.',
        })
        return
      }

      next(error)
    }
  },
)

// POST /api/admin/vets
// Creates a draft listing linked to an existing active VET account.
adminVetsRouter.post('/', async (req, res, next) => {
  const input = req.body

  if (
    !input ||
    typeof input.providerEmail !== 'string' ||
    typeof input.slug !== 'string' ||
    typeof input.vetName !== 'string' ||
    typeof input.clinicName !== 'string' ||
    typeof input.addressLine1 !== 'string' ||
    typeof input.city !== 'string' ||
    typeof input.state !== 'string' ||
    typeof input.isDemo !== 'boolean'
  ) {
    res.status(400).json({
      message:
        'Provider email, slug, vet name, clinic name, address, city, state, and demo status are required.',
    })
    return
  }

  const providerEmail = input.providerEmail.trim().toLowerCase()
  const slug = input.slug.trim().toLowerCase()
  const vetName = input.vetName.trim()
  const clinicName = input.clinicName.trim()
  const addressLine1 = input.addressLine1.trim()
  const city = input.city.trim()
  const state = input.state.trim()
  const isDemo = input.isDemo

  if (
    providerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providerEmail)
  ) {
    res.status(400).json({
      message: 'Enter a valid provider account email.',
    })
    return
  }

  if (
    slug.length < 3 ||
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    res.status(400).json({
      message:
        'Slug must contain 3–180 characters, using lowercase letters, numbers, and single hyphens between words.',
    })
    return
  }

  const textFields = [
    { label: 'Vet name', value: vetName, max: 150 },
    { label: 'Clinic name', value: clinicName, max: 180 },
    { label: 'Address', value: addressLine1, max: 200 },
    { label: 'City', value: city, max: 100 },
    { label: 'State', value: state, max: 100 },
  ]

  for (const field of textFields) {
    if (field.value.length < 2 || field.value.length > field.max) {
      res.status(400).json({
        message: `${field.label} must contain 2–${field.max} characters.`,
      })
      return
    }
  }

  if (
    !Array.isArray(input.species) ||
    input.species.length === 0 ||
    input.species.length > 3 ||
    input.species.some(
      (value: unknown) =>
        value !== 'CAT' &&
        value !== 'DOG' &&
        value !== 'TURTLE',
    )
  ) {
    res.status(400).json({
      message: 'Choose at least one species: CAT, DOG, or TURTLE.',
    })
    return
  }

  const species = [
    ...new Set<'CAT' | 'DOG' | 'TURTLE'>(input.species),
  ]

  const actorId = req.session.userId

  if (!actorId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  try {
    const vet = await prisma.$transaction(async (tx) => {
      const administrator = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          role: true,
          status: true,
        },
      })

      if (
        !administrator ||
        administrator.role !== 'ADMIN' ||
        administrator.status !== 'ACTIVE'
      ) {
        throw new RequestError(
          403,
          'Active administrator access is required.',
        )
      }

      const provider = await tx.user.findUnique({
        where: { email: providerEmail },
        select: {
          id: true,
          role: true,
          status: true,
          vetListing: {
            select: {
              id: true,
            },
          },
        },
      })

      if (
        !provider ||
        provider.role !== 'VET' ||
        provider.status !== 'ACTIVE'
      ) {
        throw new RequestError(
          400,
          'Choose an existing active VET account.',
        )
      }

      if (provider.vetListing) {
        throw new RequestError(
          409,
          'This provider already has a listing. Edit that listing instead.',
        )
      }

      const created = await tx.vetListing.create({
        data: {
          userId: provider.id,
          slug,
          vetName,
          clinicName,
          addressLine1,
          city,
          state,
          species,
          countryCode: 'IN',
          isDemo,
          status: 'DRAFT',
          verificationStatus: 'NOT_SUBMITTED',
          publishedAt: null,
          description: isDemo
            ? 'Fictional listing for testing. This is not a real clinic and does not provide veterinary services.'
            : null,
        },
        select: {
          id: true,
          slug: true,
          clinicName: true,
          userId: true,
          status: true,
          verificationStatus: true,
          isDemo: true,
          updatedAt: true,
        },
      })

      await tx.auditEvent.create({
        data: {
          actorId,
          actorLabel: 'Authenticated administrator',
          action: 'VET_LISTING_CREATED',
          entityType: 'VetListing',
          entityId: created.id,
          details: {
            providerId: provider.id,
            slug: created.slug,
            status: created.status,
            isDemo: created.isDemo,
          },
        },
      })

      return created
    })

    res.status(201).json({
      message: 'Draft listing created and linked to the provider account.',
      vet,
    })
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(error.statusCode).json({
        message: error.message,
      })
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res.status(409).json({
        message:
          'This slug or provider account already has a listing. Reload before continuing.',
      })
      return
    }

    next(error)
  }
})

// PUT /api/admin/vets/:id
// Edits draft listings only.
// Ownership, slug, demo status, and approval cannot be changed here.
adminVetsRouter.put('/:id', async (req, res, next) => {
  const id = req.params.id
  const input = req.body

  if (!validId(id)) {
    res.status(400).json({
      message: 'Invalid vet listing ID.',
    })
    return
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    res.status(400).json({
      message: 'Provide the listing details as JSON.',
    })
    return
  }

  if (
    typeof input.updatedAt !== 'string' ||
    Number.isNaN(new Date(input.updatedAt).getTime())
  ) {
    res.status(400).json({
      message: 'Provide the current listing version. Reload first.',
    })
    return
  }

  const version = new Date(input.updatedAt)

  const requiredFields = [
    { key: 'vetName', label: 'Vet name', max: 150 },
    { key: 'clinicName', label: 'Clinic name', max: 180 },
    { key: 'addressLine1', label: 'Address', max: 200 },
    { key: 'city', label: 'City', max: 100 },
    { key: 'state', label: 'State', max: 100 },
  ] as const

  for (const field of requiredFields) {
    const value = input[field.key]

    if (
      typeof value !== 'string' ||
      value.trim().length < 2 ||
      value.trim().length > field.max
    ) {
      res.status(400).json({
        message: `${field.label} must contain 2–${field.max} characters.`,
      })
      return
    }
  }

  const optionalFields = [
    { key: 'qualifications', max: 250 },
    { key: 'registrationNumber', max: 100 },
    { key: 'registrationBody', max: 180 },
    { key: 'description', max: 5000 },
    { key: 'addressLine2', max: 200 },
    { key: 'postalCode', max: 20 },
    { key: 'phone', max: 30 },
    { key: 'email', max: 254 },
    { key: 'websiteUrl', max: 2048 },
    { key: 'openingHours', max: 1000 },
  ] as const

  for (const field of optionalFields) {
    const value = input[field.key]

    if (
      value !== null &&
      (typeof value !== 'string' || value.length > field.max)
    ) {
      res.status(400).json({
        message:
          `${field.key} must be text up to ${field.max} characters, ` +
          'or null. Include all editable fields.',
      })
      return
    }
  }

  if (
    typeof input.countryCode !== 'string' ||
    !/^[A-Za-z]{2}$/.test(input.countryCode.trim())
  ) {
    res.status(400).json({
      message: 'Enter a two-letter country code, such as IN.',
    })
    return
  }

  if (
    !Array.isArray(input.species) ||
    input.species.length === 0 ||
    input.species.length > 3 ||
    input.species.some(
      (value: unknown) =>
        value !== 'CAT' &&
        value !== 'DOG' &&
        value !== 'TURTLE',
    )
  ) {
    res.status(400).json({
      message: 'Choose at least one species: CAT, DOG, or TURTLE.',
    })
    return
  }

  function optionalText(value: string | null): string | null {
    return value?.trim() || null
  }

  const email = optionalText(input.email)?.toLowerCase() ?? null
  const phone = optionalText(input.phone)
  let websiteUrl = optionalText(input.websiteUrl)

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({
      message: 'Enter a valid clinic contact email.',
    })
    return
  }

  if (phone) {
    const normalized = phone.replace(/[\s().-]/g, '')

    if (!/^\+?\d{7,15}$/.test(normalized)) {
      res.status(400).json({
        message:
          'Enter a phone number with 7–15 digits and an optional leading +.',
      })
      return
    }
  }

  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl)

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.href.length > 2048
      ) {
        throw new Error('Invalid website URL')
      }

      websiteUrl = url.href
    } catch {
      res.status(400).json({
        message:
          'Enter a complete HTTP or HTTPS website URL without embedded login details.',
      })
      return
    }
  }

  const latitude = input.latitude
  const longitude = input.longitude

  if (
    latitude !== null &&
    typeof latitude !== 'number'
  ) {
    res.status(400).json({
      message: 'Latitude must be a number or null.',
    })
    return
  }

  if (
    longitude !== null &&
    typeof longitude !== 'number'
  ) {
    res.status(400).json({
      message: 'Longitude must be a number or null.',
    })
    return
  }

  if ((latitude === null) !== (longitude === null)) {
    res.status(400).json({
      message:
        'Latitude and longitude must both be provided or both be empty.',
    })
    return
  }

  if (
    latitude !== null &&
    (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
  ) {
    res.status(400).json({
      message: 'Latitude must be between -90 and 90.',
    })
    return
  }

  if (
    longitude !== null &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  ) {
    res.status(400).json({
      message: 'Longitude must be between -180 and 180.',
    })
    return
  }

  const species = [
    ...new Set<'CAT' | 'DOG' | 'TURTLE'>(input.species),
  ]

  const actorId = req.session.userId

  if (!actorId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  try {
    const vet = await prisma.$transaction(async (tx) => {
      const administrator = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          role: true,
          status: true,
        },
      })

      if (
        !administrator ||
        administrator.role !== 'ADMIN' ||
        administrator.status !== 'ACTIVE'
      ) {
        throw new RequestError(
          403,
          'Active administrator access is required.',
        )
      }

      const existing = await tx.vetListing.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new RequestError(404, 'Vet listing not found.')
      }

      if (
        existing.status !== 'DRAFT' ||
        existing.updatedAt.getTime() !== version.getTime()
      ) {
        throw new RequestError(
          409,
          'The listing has changed or is not a draft. Reload it before editing.',
        )
      }

      if (
        existing.verificationStatus === 'SUBMITTED' ||
        existing.verificationStatus === 'UNDER_REVIEW'
      ) {
        throw new RequestError(
          409,
          'Editing is locked while verification is pending.',
        )
      }

      const nextVerificationStatus =
        existing.verificationStatus === 'SUSPENDED'
          ? 'SUSPENDED'
          : 'NOT_SUBMITTED'

      const changes: Prisma.VetListingUncheckedUpdateManyInput = {
        vetName: input.vetName.trim(),
        clinicName: input.clinicName.trim(),
        qualifications: optionalText(input.qualifications),
        registrationNumber: optionalText(input.registrationNumber),
        registrationBody: optionalText(input.registrationBody),
        description: optionalText(input.description),
        species,
        addressLine1: input.addressLine1.trim(),
        addressLine2: optionalText(input.addressLine2),
        city: input.city.trim(),
        state: input.state.trim(),
        postalCode: optionalText(input.postalCode),
        countryCode: input.countryCode.trim().toUpperCase(),
        latitude,
        longitude,
        phone,
        email,
        websiteUrl,
        openingHours: optionalText(input.openingHours),
        verificationStatus: nextVerificationStatus,
        verificationSubmittedAt: null,
        lastConfirmedAt: null,
        publishedAt: null,
        updatedAt: new Date(
          Math.max(Date.now(), existing.updatedAt.getTime() + 1),
        ),
      }

      if (existing.verificationStatus !== 'SUSPENDED') {
        changes.verificationReviewedAt = null
        changes.verificationReviewedById = null
        changes.verificationNotes = null
        changes.verificationEvidenceReferences = null
      }

      const result = await tx.vetListing.updateMany({
        where: {
          id,
          status: 'DRAFT',
          verificationStatus: existing.verificationStatus,
          updatedAt: existing.updatedAt,
        },
        data: changes,
      })

      if (result.count !== 1) {
        throw new RequestError(
          409,
          'The listing changed during the request. Reload it.',
        )
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          actorLabel: 'Authenticated administrator',
          action: 'VET_LISTING_DRAFT_UPDATED',
          entityType: 'VetListing',
          entityId: id,
          details: {
            previousVersion: existing.updatedAt.toISOString(),
            previousVerificationStatus: existing.verificationStatus,
            newVerificationStatus: nextVerificationStatus,
            previousCoordinates: {
              latitude: existing.latitude,
              longitude: existing.longitude,
            },
            newCoordinates: {
              latitude,
              longitude,
            },
            isDemo: existing.isDemo,
          },
        },
      })

      return tx.vetListing.findUniqueOrThrow({
        where: { id },
      })
    })

    res.json({
      message:
        'Draft saved. Updated provider details require verification before real listing publication.',
      vet,
    })
  } catch (error) {
    if (error instanceof RequestError) {
      res.status(error.statusCode).json({
        message: error.message,
      })
      return
    }

    next(error)
  }
})

// POST /api/admin/vets/:id/booking-settings
adminVetsRouter.post(
  '/:id/booking-settings',
  async (req, res, next) => {
    const id = req.params.id
    const input = req.body

    if (!validId(id)) {
      res.status(400).json({
        message: 'Invalid vet listing ID.',
      })
      return
    }

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      typeof input.bookingEnabled !== 'boolean'
    ) {
      res.status(400).json({
        message: 'Provide bookingEnabled as true or false.',
      })
      return
    }

    if (
      typeof input.updatedAt !== 'string' ||
      Number.isNaN(new Date(input.updatedAt).getTime())
    ) {
      res.status(400).json({
        message: 'Provide the current listing version. Reload first.',
      })
      return
    }

    if (
      typeof input.reason !== 'string' ||
      input.reason.trim().length < 5 ||
      input.reason.trim().length > 2000
    ) {
      res.status(400).json({
        message: 'Provide a reason containing 5–2,000 characters.',
      })
      return
    }

    const enabled = input.bookingEnabled
    const version = new Date(input.updatedAt)
    const reason = input.reason.trim()
    let timeZone: string | undefined

    if (enabled) {
      if (input.operationConfirmed !== true) {
        res.status(400).json({
          message:
            'Confirm that the provider will monitor requests, or that this is a clearly labelled demo test.',
        })
        return
      }

      if (
        typeof input.timeZone !== 'string' ||
        input.timeZone.trim().length === 0 ||
        input.timeZone.trim().length > 100
      ) {
        res.status(400).json({
          message: 'Provide the clinic time zone, such as Asia/Kolkata.',
        })
        return
      }

      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: input.timeZone.trim(),
        })

        timeZone = formatter.resolvedOptions().timeZone
      } catch {
        res.status(400).json({
          message: 'Enter a valid time zone, such as Asia/Kolkata.',
        })
        return
      }
    }

    const actorId = req.session.userId

    if (!actorId) {
      res.status(401).json({
        message: 'Please sign in.',
      })
      return
    }

    try {
      const vet = await prisma.$transaction(async (tx) => {
        const administrator = await tx.user.findUnique({
          where: { id: actorId },
          select: {
            role: true,
            status: true,
          },
        })

        if (
          !administrator ||
          administrator.role !== 'ADMIN' ||
          administrator.status !== 'ACTIVE'
        ) {
          throw new RequestError(
            403,
            'Active administrator access is required.',
          )
        }

        const existing = await tx.vetListing.findUnique({
          where: { id },
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

        if (!existing) {
          throw new RequestError(404, 'Vet listing not found.')
        }

        if (existing.updatedAt.getTime() !== version.getTime()) {
          throw new RequestError(
            409,
            'The listing has changed. Reload before continuing.',
          )
        }

        const now = new Date()

        if (enabled) {
          if (
            existing.status !== 'PUBLISHED' ||
            !existing.publishedAt ||
            existing.publishedAt > now
          ) {
            throw new RequestError(
              400,
              'Publish the listing before enabling appointment requests.',
            )
          }

          if (
            !existing.user ||
            existing.user.role !== 'VET' ||
            existing.user.status !== 'ACTIVE'
          ) {
            throw new RequestError(
              400,
              'The listing needs a linked active VET account.',
            )
          }

          if (existing.verificationStatus === 'SUSPENDED') {
            throw new RequestError(
              400,
              'Suspended listings cannot accept new requests.',
            )
          }

          if (existing.species.length === 0) {
            throw new RequestError(
              400,
              'Record the supported species before enabling requests.',
            )
          }

          if (!existing.isDemo) {
            if (
              existing.verificationStatus !== 'APPROVED' ||
              !existing.verificationReviewedAt ||
              existing.verificationReviewedAt > now ||
              !existing.verificationReviewedById ||
              !existing.verificationEvidenceReferences?.trim()
            ) {
              throw new RequestError(
                400,
                'Complete real provider verification first.',
              )
            }

            if (
              (!existing.phone?.trim() && !existing.email?.trim()) ||
              !existing.openingHours?.trim()
            ) {
              throw new RequestError(
                400,
                'Record clinic contact details and opening hours first.',
              )
            }
          }

          if (timeZone !== existing.timeZone) {
            const hasHistory = await tx.appointment.findFirst({
              where: { vetListingId: id },
              select: { id: true },
            })

            if (hasHistory) {
              throw new RequestError(
                409,
                'This listing has appointment history. Keep its existing time zone when changing booking settings.',
              )
            }
          }
        }

        const result = await tx.vetListing.updateMany({
          where: {
            id,
            updatedAt: existing.updatedAt,
            ...(enabled
              ? {
                  user: {
                    is: {
                      role: 'VET',
                      status: 'ACTIVE',
                    },
                  },
                }
              : {}),
          },
          data: {
            bookingEnabled: enabled,
            ...(enabled && timeZone ? { timeZone } : {}),
            updatedAt: new Date(
              Math.max(now.getTime(), existing.updatedAt.getTime() + 1),
            ),
          },
        })

        if (result.count !== 1) {
          throw new RequestError(
            409,
            'The listing or provider account changed. Reload before continuing.',
          )
        }

        await tx.auditEvent.create({
          data: {
            actorId,
            actorLabel: 'Authenticated administrator',
            action: enabled
              ? 'VET_BOOKING_ENABLED'
              : 'VET_BOOKING_DISABLED',
            entityType: 'VetListing',
            entityId: id,
            details: {
              reason,
              previousBookingEnabled: existing.bookingEnabled,
              newBookingEnabled: enabled,
              previousTimeZone: existing.timeZone,
              newTimeZone: enabled
                ? timeZone ?? existing.timeZone
                : existing.timeZone,
              isDemo: existing.isDemo,
              operationConfirmed: enabled,
            },
          },
        })

        return tx.vetListing.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            clinicName: true,
            bookingEnabled: true,
            timeZone: true,
            isDemo: true,
            updatedAt: true,
          },
        })
      })

      res.json({
        message: enabled
          ? vet.isDemo
            ? 'Demo appointment requests enabled. This does not provide real veterinary services.'
            : 'Appointment requests enabled.'
          : 'New appointment requests disabled. Existing appointments are unchanged.',
        vet,
      })
    } catch (error) {
      if (error instanceof RequestError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)

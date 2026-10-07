import { Router } from 'express'
import type { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import type {} from './auth.js'

export const providerVetsRouter = Router()

class ProviderRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

// Public-facing listing fields plus the provider's own registration
// details. Internal administrator notes and evidence are excluded.
const providerListingSelect = {
  id: true,
  slug: true,
  vetName: true,
  clinicName: true,
  qualifications: true,
  registrationNumber: true,
  registrationBody: true,
  description: true,
  species: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  countryCode: true,
  phone: true,
  email: true,
  websiteUrl: true,
  openingHours: true,
  status: true,
  isDemo: true,
  verificationStatus: true,
  verificationSubmittedAt: true,
  verificationReviewedAt: true,
  publishedAt: true,
  lastConfirmedAt: true,
  updatedAt: true,
} satisfies Prisma.VetListingSelect

// Check the current database role on every request.
providerVetsRouter.use(async (req, res, next) => {
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

    if (user.role !== 'VET') {
      res.status(403).json({
        message: 'A veterinarian account is required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// Protect requests that modify provider information.
providerVetsRouter.use((req, res, next) => {
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

// GET /api/provider/vet
providerVetsRouter.get('/', async (req, res, next) => {
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
        id: true,
        name: true,
        role: true,
        status: true,
        vetListing: {
          select: providerListingSelect,
        },
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        message: 'Please sign in again.',
      })
      return
    }

    if (user.role !== 'VET') {
      res.status(403).json({
        message: 'A veterinarian account is required.',
      })
      return
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
      },
      vet: user.vetListing,
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/provider/vet
// The listing is selected using the session, never a client-supplied ID.
providerVetsRouter.put('/', async (req, res, next) => {
  const input = req.body

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    res.status(400).json({
      message: 'Provide the listing details as JSON.',
    })
    return
  }

  const editableFields = [
    'vetName',
    'clinicName',
    'qualifications',
    'registrationNumber',
    'registrationBody',
    'description',
    'species',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
    'countryCode',
    'phone',
    'email',
    'websiteUrl',
    'openingHours',
    'updatedAt',
  ]

  if (
    Object.keys(input).some(
      (key) => !editableFields.includes(key),
    )
  ) {
    res.status(400).json({
      message:
        'Only listing details and the current version can be submitted. Ownership, publication, demo status, and verification cannot be changed here.',
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
        message:
          `${field.label} must contain 2–${field.max} characters.`,
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

  // Blank optional fields must be supplied as "" or null.
  // Missing fields are rejected to avoid accidental data loss.
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

  const species = [
    ...new Set<'CAT' | 'DOG' | 'TURTLE'>(input.species),
  ]

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  try {
    const vet = await prisma.$transaction(async (tx) => {
      const provider = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          status: true,
        },
      })

      if (
        !provider ||
        provider.role !== 'VET' ||
        provider.status !== 'ACTIVE'
      ) {
        throw new ProviderRequestError(
          403,
          'An active veterinarian account is required.',
        )
      }

      const existing = await tx.vetListing.findUnique({
        where: { userId },
      })

      if (!existing) {
        throw new ProviderRequestError(
          404,
          'No listing is linked to your account.',
        )
      }

      if (
        existing.status !== 'DRAFT' ||
        existing.updatedAt.getTime() !== version.getTime()
      ) {
        throw new ProviderRequestError(
          409,
          'Your listing has changed or is not a draft. Reload it. Ask the administrator to return published or archived listings to draft.',
        )
      }

      if (
        existing.verificationStatus === 'SUBMITTED' ||
        existing.verificationStatus === 'UNDER_REVIEW'
      ) {
        throw new ProviderRequestError(
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

      // Editing never clears a suspension.
      if (existing.verificationStatus !== 'SUSPENDED') {
        changes.verificationReviewedAt = null
        changes.verificationReviewedById = null
        changes.verificationNotes = null
        changes.verificationEvidenceReferences = null
      }

      const result = await tx.vetListing.updateMany({
        where: {
          id: existing.id,
          userId,
          status: 'DRAFT',
          verificationStatus: existing.verificationStatus,
          updatedAt: existing.updatedAt,
          user: {
            is: {
              role: 'VET',
              status: 'ACTIVE',
            },
          },
        },
        data: changes,
      })

      if (result.count !== 1) {
        throw new ProviderRequestError(
          409,
          'Your listing or account changed during the request. Reload before continuing.',
        )
      }

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          actorLabel: 'Authenticated veterinarian',
          action: 'VET_PROVIDER_DRAFT_UPDATED',
          entityType: 'VetListing',
          entityId: existing.id,
          details: {
            previousVersion: existing.updatedAt.toISOString(),
            previousVerificationStatus: existing.verificationStatus,
            newVerificationStatus: nextVerificationStatus,
            isDemo: existing.isDemo,
          },
        },
      })

      return tx.vetListing.findUniqueOrThrow({
        where: { id: existing.id },
        select: providerListingSelect,
      })
    })

    res.json({
      message: vet.isDemo
        ? 'Demo draft saved. It has not been published.'
        : 'Draft saved. Updated details require verification before publication.',
      vet,
    })
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      res.status(error.statusCode).json({
        message: error.message,
      })
      return
    }

    next(error)
  }
})
// POST /api/provider/vet/submit-review
// A provider can submit only their own saved draft.
providerVetsRouter.post('/submit-review', async (req, res, next) => {
  const input = req.body

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.updatedAt !== 'string' ||
    Number.isNaN(new Date(input.updatedAt).getTime())
  ) {
    res.status(400).json({
      message: 'Provide the current listing version. Reload first.',
    })
    return
  }

  if (
    Object.keys(input).some(
      (key) => key !== 'updatedAt' && key !== 'detailsConfirmed',
    )
  ) {
    res.status(400).json({
      message: 'Only the listing version and confirmation are accepted.',
    })
    return
  }

  if (input.detailsConfirmed !== true) {
    res.status(400).json({
      message:
        'Confirm that your saved professional and clinic details are accurate.',
    })
    return
  }

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  const version = new Date(input.updatedAt)

  try {
    const vet = await prisma.$transaction(async (tx) => {
      const provider = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          status: true,
        },
      })

      if (
        !provider ||
        provider.role !== 'VET' ||
        provider.status !== 'ACTIVE'
      ) {
        throw new ProviderRequestError(
          403,
          'An active veterinarian account is required.',
        )
      }

      const existing = await tx.vetListing.findUnique({
        where: { userId },
      })

      if (!existing) {
        throw new ProviderRequestError(
          404,
          'No listing is linked to your account.',
        )
      }

      if (existing.isDemo) {
        throw new ProviderRequestError(
          400,
          'Demo listings cannot undergo real provider verification.',
        )
      }

      if (
        existing.status !== 'DRAFT' ||
        existing.updatedAt.getTime() !== version.getTime()
      ) {
        throw new ProviderRequestError(
          409,
          'Your listing has changed or is not a draft. Reload before continuing.',
        )
      }

      // Suspended providers must contact the administrator.
      // They cannot clear or replace their suspension themselves.
      if (existing.verificationStatus === 'SUSPENDED') {
        throw new ProviderRequestError(
          403,
          'Your listing is suspended. Contact the administrator about resubmission.',
        )
      }

      if (
        existing.verificationStatus !== 'NOT_SUBMITTED' &&
        existing.verificationStatus !== 'REJECTED'
      ) {
        throw new ProviderRequestError(
          409,
          'This listing has already been submitted or approved. Reload to check its status.',
        )
      }

      const missingFields: string[] = []

      if (!existing.vetName.trim()) {
        missingFields.push('vet name')
      }

      if (!existing.clinicName.trim()) {
        missingFields.push('clinic name')
      }

      if (!existing.qualifications?.trim()) {
        missingFields.push('qualifications')
      }

      if (!existing.registrationNumber?.trim()) {
        missingFields.push('registration number')
      }

      if (!existing.registrationBody?.trim()) {
        missingFields.push('registration body')
      }

      if (!existing.addressLine1.trim()) {
        missingFields.push('address')
      }

      if (!existing.city.trim()) {
        missingFields.push('city')
      }

      if (!existing.state.trim()) {
        missingFields.push('state')
      }

      if (!/^[A-Z]{2}$/.test(existing.countryCode)) {
        missingFields.push('valid country code')
      }

      if (existing.species.length === 0) {
        missingFields.push('supported species')
      }

      if (!existing.phone?.trim() && !existing.email?.trim()) {
        missingFields.push('phone or email')
      }

      if (!existing.openingHours?.trim()) {
        missingFields.push('opening hours')
      }

      if (missingFields.length > 0) {
        throw new ProviderRequestError(
          400,
          `Complete these details before submitting: ${missingFields.join(', ')}.`,
        )
      }

      const now = new Date()

      const result = await tx.vetListing.updateMany({
        where: {
          id: existing.id,
          userId,
          isDemo: false,
          status: 'DRAFT',
          verificationStatus: existing.verificationStatus,
          updatedAt: existing.updatedAt,
          user: {
            is: {
              role: 'VET',
              status: 'ACTIVE',
            },
          },
        },
        data: {
          verificationStatus: 'SUBMITTED',
          verificationSubmittedAt: now,
          verificationReviewedAt: null,
          verificationReviewedById: null,
          verificationNotes: null,
          verificationEvidenceReferences: null,
          publishedAt: null,
          lastConfirmedAt: null,
          updatedAt: new Date(
            Math.max(
              now.getTime(),
              existing.updatedAt.getTime() + 1,
            ),
          ),
        },
      })

      if (result.count !== 1) {
        throw new ProviderRequestError(
          409,
          'Your listing or account changed during the request. Reload before continuing.',
        )
      }

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          actorLabel: 'Authenticated veterinarian',
          action: 'VET_PROVIDER_SUBMITTED_FOR_VERIFICATION',
          entityType: 'VetListing',
          entityId: existing.id,
          details: {
            previousVerificationStatus: existing.verificationStatus,
            newVerificationStatus: 'SUBMITTED',
            submittedVersion: existing.updatedAt.toISOString(),
            detailsConfirmed: true,
          },
        },
      })

      return tx.vetListing.findUniqueOrThrow({
        where: { id: existing.id },
        select: providerListingSelect,
      })
    })

    res.json({
      message:
        'Submitted for verification. Editing is locked while your listing awaits review. Your listing is not public.',
      vet,
    })
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      res.status(error.statusCode).json({
        message: error.message,
      })
      return
    }

    next(error)
  }
})
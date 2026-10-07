import { Router } from 'express'
import type { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'

export const ambulancesRouter = Router()

// GET /api/ambulances?city=Mumbai&state=Maharashtra&species=CAT&page=1
ambulancesRouter.get('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  const { city, state, species, page, id } = req.query

  if (
    id !== undefined &&
    (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    )
  ) {
    res.status(400).json({ message: 'Invalid provider ID.' })
    return
  }

  for (const [name, value] of [
    ['city', city],
    ['state', state],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== 'string' || value.length > 100)
    ) {
      res.status(400).json({
        message: `${name} must be text up to 100 characters.`,
      })
      return
    }
  }

  if (
    species !== undefined &&
    species !== 'CAT' &&
    species !== 'DOG' &&
    species !== 'TURTLE'
  ) {
    res.status(400).json({
      message: 'Species must be CAT, DOG, or TURTLE.',
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

  const now = new Date()
  const pageNumber = page === undefined ? 1 : Number(page)
  const pageSize = 12

  const cityKey =
    typeof city === 'string'
      ? city.trim().replace(/\s+/g, ' ').toLowerCase()
      : ''

  const stateKey =
    typeof state === 'string'
      ? state.trim().replace(/\s+/g, ' ').toLowerCase()
      : ''

  const conditions: Prisma.AmbulanceListingWhereInput[] = [
    {
      status: 'PUBLISHED',
      publishedAt: { lte: now },
      verificationStatus: { not: 'SUSPENDED' },
      OR: [
        { isDemo: true },
        {
          isDemo: false,
          verificationStatus: 'APPROVED',
          verificationReviewedAt: { lte: now },
          verificationReviewedById: { not: null },
          user: {
            is: {
              role: 'AMBULANCE_PROVIDER',
              status: 'ACTIVE',
            },
          },
        },
      ],
    },
  ]

  // Both location filters must match the same service-area record.
  if (cityKey || stateKey) {
    conditions.push({
      serviceAreas: {
        some: {
          countryCode: 'IN',
          ...(cityKey ? { cityKey } : {}),
          ...(stateKey ? { stateKey } : {}),
        },
      },
    })
  }

  if (species !== undefined) {
    conditions.push({
      species: { has: species },
    })
  }

  if (typeof id === 'string') {
    conditions.push({ id })
  }

  const where: Prisma.AmbulanceListingWhereInput = {
    AND: conditions,
  }

  try {
    const [listings, total] = await prisma.$transaction([
      prisma.ambulanceListing.findMany({
        where,
        orderBy: [
          { providerName: 'asc' },
          { id: 'asc' },
        ],
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
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
          isDemo: true,
          requestsEnabled: true,
          availability: true,
          availabilityUpdatedAt: true,
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
      }),
      prisma.ambulanceListing.count({ where }),
    ])

    // Initial freshness policy: provider updates last for 30 minutes.
    const freshnessMs = 30 * 60 * 1000

    res.json({
      ambulances: listings.map((listing) => {
        const updatedAt = listing.availabilityUpdatedAt?.getTime()

        const fresh =
          updatedAt !== undefined &&
          updatedAt <= now.getTime() &&
          now.getTime() - updatedAt < freshnessMs

        return {
          ...listing,
          // Demo listings must not expose actionable contact details.
          phone: listing.isDemo ? null : listing.phone,
          email: listing.isDemo ? null : listing.email,
          websiteUrl: listing.isDemo ? null : listing.websiteUrl,
          availability: fresh ? listing.availability : 'UNKNOWN',
          availabilityIsFresh: fresh,
          canRequest:
          !listing.isDemo &&
          listing.requestsEnabled &&
          fresh &&
          listing.availability === 'AVAILABLE',
        }
      }),
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    next(error)
  }
})
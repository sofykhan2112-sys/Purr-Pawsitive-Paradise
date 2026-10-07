import { Router } from 'express'
import { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import { sessionMiddleware } from './auth.js'
import { rateLimit } from 'express-rate-limit'

export const vetsRouter = Router()

function publicVetFilter(): Prisma.VetListingWhereInput {
  return {
    status: 'PUBLISHED',
    publishedAt: {
      lte: new Date(),
    },
    verificationStatus: {
      not: 'SUSPENDED',
    },
    OR: [
      {
        isDemo: true,
      },
      {
        isDemo: false,
        verificationStatus: 'APPROVED',
        verificationReviewedAt: {
          lte: new Date(),
        },
        verificationReviewedById: {
          not: null,
        },
        user: {
          is: {
            role: 'VET',
            status: 'ACTIVE',
          },
        },
      },
    ],
  }
}

// GET /api/vets?city=Mumbai&species=CAT&q=clinic&page=1
type NearbyVetCandidate = {
  id: string
  slug: string
  vetName: string
  clinicName: string
  qualifications: string | null
  description: string | null
  species: ('CAT' | 'DOG' | 'TURTLE')[]
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string | null
  countryCode: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  websiteUrl: string | null
  openingHours: string | null
  isDemo: boolean
  lastConfirmedAt: Date | null
  verificationStatus: string
  verificationReviewedAt: Date | null
}

function degreesToRadians(
  degrees: number,
) {
  return (
    degrees *
    (Math.PI / 180)
  )
}

function distanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
) {
  const earthRadiusKm =
    6371

  const latitudeDelta =
    degreesToRadians(
      latitude2 -
        latitude1,
    )

  const longitudeDelta =
    degreesToRadians(
      longitude2 -
        longitude1,
    )

  const firstLatitude =
    degreesToRadians(
      latitude1,
    )

  const secondLatitude =
    degreesToRadians(
      latitude2,
    )

  const a =
    Math.sin(
      latitudeDelta / 2,
    ) **
      2 +
    Math.cos(
      firstLatitude,
    ) *
      Math.cos(
        secondLatitude,
      ) *
      Math.sin(
        longitudeDelta / 2,
      ) **
        2

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )

  return (
    earthRadiusKm * c
  )
}

// GET /api/vets
//
// Manual examples:
// /api/vets?city=Mumbai&species=CAT&q=clinic&page=1
//
// Nearby example:
// /api/vets?latitude=19.076&longitude=72.8777&radiusKm=25&page=1
vetsRouter.get(
  '/',
  async (
    req,
    res,
    next,
  ) => {
    const {
      species,
      city,
      postalCode,
      q,
      page,
      latitude,
      longitude,
      radiusKm,
    } = req.query

    if (
      species !==
        undefined &&
      species !== 'CAT' &&
      species !== 'DOG' &&
      species !==
        'TURTLE'
    ) {
      res.status(400).json({
        message:
          'Species must be CAT, DOG, or TURTLE.',
      })
      return
    }

    if (
      city !== undefined &&
      (
        typeof city !==
          'string' ||
        city.length > 100
      )
    ) {
      res.status(400).json({
        message:
          'City must be text with at most 100 characters.',
      })
      return
    }

    if (
      postalCode !== undefined &&
      (
        typeof postalCode !== 'string' ||
        postalCode.length > 20
      )
    ) {
      res.status(400).json({
        message:
          'Postcode must be text with at most 20 characters.',
      })
    
      return
    }

    if (
      q !== undefined &&
      (
        typeof q !==
          'string' ||
        q.length > 100
      )
    ) {
      res.status(400).json({
        message:
          'Search must be text with at most 100 characters.',
      })
      return
    }

    if (
      page !== undefined &&
      (
        typeof page !==
          'string' ||
        !/^[1-9]\d{0,4}$/.test(
          page,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Page must be a positive number up to 99999.',
      })
      return
    }

    const hasLatitude =
      latitude !== undefined

    const hasLongitude =
      longitude !== undefined

    if (
      hasLatitude !==
      hasLongitude
    ) {
      res.status(400).json({
        message:
          'Latitude and longitude must be provided together.',
      })
      return
    }

    let userLatitude:
      | number
      | null = null

    let userLongitude:
      | number
      | null = null

    let requestedRadiusKm =
      25

    if (
      hasLatitude &&
      hasLongitude
    ) {
      if (
        typeof latitude !==
          'string' ||
        typeof longitude !==
          'string'
      ) {
        res.status(400).json({
          message:
            'Latitude and longitude must be numbers.',
        })
        return
      }

      userLatitude =
        Number(latitude)

      userLongitude =
        Number(longitude)

      if (
        !Number.isFinite(
          userLatitude,
        ) ||
        userLatitude < -90 ||
        userLatitude > 90
      ) {
        res.status(400).json({
          message:
            'Latitude must be between -90 and 90.',
        })
        return
      }

      if (
        !Number.isFinite(
          userLongitude,
        ) ||
        userLongitude < -180 ||
        userLongitude > 180
      ) {
        res.status(400).json({
          message:
            'Longitude must be between -180 and 180.',
        })
        return
      }

      if (
        radiusKm !==
        undefined
      ) {
        if (
          typeof radiusKm !==
            'string'
        ) {
          res.status(400).json({
            message:
              'Search radius must be a number.',
          })
          return
        }

        requestedRadiusKm =
          Number(radiusKm)

        if (
          !Number.isFinite(
            requestedRadiusKm,
          ) ||
          requestedRadiusKm <
            1 ||
          requestedRadiusKm >
            100
        ) {
          res.status(400).json({
            message:
              'Search radius must be between 1 and 100 kilometres.',
          })
          return
        }
      }
    } else if (
      radiusKm !== undefined
    ) {
      res.status(400).json({
        message:
          'A radius can only be used with latitude and longitude.',
      })
      return
    }

    const pageNumber =
      page === undefined
        ? 1
        : Number(page)

    const pageSize = 12

    const citySearch =
  typeof city ===
  'string'
    ? city.trim()
    : ''

const postalCodeSearch =
  typeof postalCode ===
  'string'
    ? postalCode.trim()
    : ''

const search =
  typeof q ===
  'string'
    ? q.trim()
    : ''

    const conditions:
      Prisma.VetListingWhereInput[] =
      [
        publicVetFilter(),
      ]

    if (
      species !==
      undefined
    ) {
      conditions.push({
        species: {
          has: species,
        },
      })
    }

    if (citySearch) {
      conditions.push({
        city: {
          contains:
            citySearch,

          mode:
            'insensitive',
        },
      })
    }

    if (postalCodeSearch) {
      conditions.push({
        postalCode: {
          contains:
            postalCodeSearch,
    
          mode:
            'insensitive',
        },
      })
    }

    if (search) {
      conditions.push({
        OR: [
          {
            vetName: {
              contains:
                search,

              mode:
                'insensitive',
            },
          },

          {
            clinicName: {
              contains:
                search,

              mode:
                'insensitive',
            },
          },

          {
            city: {
              contains:
                search,

              mode:
                'insensitive',
            },
          },

          {
            state: {
              contains:
                search,

              mode:
                'insensitive',
            },
          },
        ],
      })
    }

    const where:
      Prisma.VetListingWhereInput =
      {
        AND:
          conditions,
      }

    const select =
      {
        id: true,
        slug: true,
        vetName: true,
        clinicName: true,
        qualifications:
          true,
        description: true,
        species: true,
        addressLine1:
          true,
        addressLine2:
          true,
        city: true,
        state: true,
        postalCode: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        phone: true,
        email: true,
        websiteUrl: true,
        openingHours:
          true,
        isDemo: true,
        lastConfirmedAt:
          true,
        verificationStatus:
          true,
        verificationReviewedAt:
          true,
      } satisfies Prisma.VetListingSelect

    try {
      // Normal manual directory search.
      if (
        userLatitude ===
          null ||
        userLongitude ===
          null
      ) {
        const [
          vets,
          total,
        ] =
          await prisma
            .$transaction([
              prisma
                .vetListing
                .findMany({
                  where,

                  orderBy: [
                    {
                      clinicName:
                        'asc',
                    },

                    {
                      id: 'asc',
                    },
                  ],

                  skip:
                    (
                      pageNumber -
                      1
                    ) *
                    pageSize,

                  take:
                    pageSize,

                  select,
                }),

              prisma
                .vetListing
                .count({
                  where,
                }),
            ])

        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          vets:
            vets.map(
              ({
                latitude:
                  _latitude,
                longitude:
                  _longitude,
                ...vet
              }) => ({
                ...vet,
                distanceKm:
                  null,
              }),
            ),

          total,

          page:
            pageNumber,

          pageSize,

          totalPages:
            Math.ceil(
              total /
                pageSize,
            ),

          locationSearch:
            false,
        })

        return
      }

      // Nearby mode.
      //
      // We intentionally calculate distance only for
      // listings with administrator-supplied coordinates.
      // Listings without coordinates are not presented
      // as "nearby".
      const candidates =
        (await prisma
          .vetListing
          .findMany({
            where: {
              AND: [
                where,

                {
                  latitude: {
                    not: null,
                  },

                  longitude: {
                    not: null,
                  },
                },
              ],
            },

            orderBy: [
              {
                clinicName:
                  'asc',
              },

              {
                id: 'asc',
              },
            ],

            take: 500,

            select,
          })) as NearbyVetCandidate[]

      const nearby =
        candidates
          .flatMap(
            (vet) => {
              if (
                vet.latitude ===
                  null ||
                vet.longitude ===
                  null
              ) {
                return []
              }

              const calculatedDistance =
                distanceKm(
                  userLatitude!,
                  userLongitude!,
                  vet.latitude,
                  vet.longitude,
                )

              if (
                calculatedDistance >
                requestedRadiusKm
              ) {
                return []
              }

              const {
                latitude:
                  _latitude,
                longitude:
                  _longitude,
                ...publicVet
              } = vet

              return [
                {
                  ...publicVet,

                  distanceKm:
                    Math.round(
                      calculatedDistance *
                        10,
                    ) / 10,
                },
              ]
            },
          )
          .sort(
            (
              first,
              second,
            ) => {
              if (
                first.distanceKm !==
                second.distanceKm
              ) {
                return (
                  first.distanceKm -
                  second.distanceKm
                )
              }

              return first.clinicName
                .localeCompare(
                  second.clinicName,
                )
            },
          )

      const total =
        nearby.length

      const totalPages =
        Math.ceil(
          total /
            pageSize,
        )

      const startIndex =
        (
          pageNumber -
          1
        ) *
        pageSize

      const vets =
        nearby.slice(
          startIndex,
          startIndex +
            pageSize,
        )

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        vets,
        total,
        page:
          pageNumber,
        pageSize,
        totalPages,

        locationSearch:
          true,

        radiusKm:
          requestedRadiusKm,
      })
    } catch (error) {
      next(error)
    }
  },
)
// GET /api/vets/:id/booking
// Only currently eligible providers can be selected for requests.
vetsRouter.get('/:id/booking', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  const id = req.params.id

  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({
      message: 'Invalid vet listing ID.',
    })
    return
  }

  try {
    const vet = await prisma.vetListing.findFirst({
      where: {
        AND: [
          publicVetFilter(),
          {
            id,
            bookingEnabled: true,
            species: { isEmpty: false },
            user: {
              is: {
                role: 'VET',
                status: 'ACTIVE',
              },
            },
            OR: [
              { isDemo: true },
              {
                isDemo: false,
                verificationEvidenceReferences: {
                  not: null,
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        clinicName: true,
        vetName: true,
        city: true,
        state: true,
        species: true,
        timeZone: true,
        isDemo: true,
        availabilityEnabled: true,
    availabilityWindows: {
    orderBy: [
      { weekday: 'asc' },
      { startMinute: 'asc' },
   ],
    select: {
      weekday: true,
      startMinute: true,
      endMinute: true,
  },
},
      },
    })

    if (!vet) {
      res.status(404).json({
        message:
          'This provider is not currently accepting appointment requests.',
      })
      return
    }

    res.json({ vet })
  } catch (error) {
    next(error)
  }
})
class SlotLookupError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

const slotLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many availability checks. Please try again later.',
  },
})

function isSlotUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

// GET /api/vets/:id/slots?petId=...&date=YYYY-MM-DD
// The date is interpreted in the clinic's time zone.
vetsRouter.get(
  '/:id/slots',
  sessionMiddleware,
  slotLookupLimiter,
  async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')

    const ownerId = req.session.userId
    const id = req.params.id
    const { petId, date } = req.query

    if (!ownerId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    if (!isSlotUuid(id) || !isSlotUuid(petId)) {
      res.status(400).json({
        message: 'Choose a valid clinic and pet.',
      })
      return
    }

    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      res.status(400).json({
        message: 'Provide a date in YYYY-MM-DD format.',
      })
      return
    }

    const anchor = new Date(`${date}T00:00:00.000Z`)

    if (
      !Number.isFinite(anchor.getTime()) ||
      anchor.toISOString().slice(0, 10) !== date
    ) {
      res.status(400).json({ message: 'Choose a valid date.' })
      return
    }

    const now = new Date()
    const day = 24 * 60 * 60 * 1000
    const minute = 60 * 1000
    const latestStart = now.getTime() + 90 * day

    // Broad bounds accommodate the clinic's UTC offset.
    if (
      anchor.getTime() < now.getTime() - 2 * day ||
      anchor.getTime() > latestStart + day
    ) {
      res.status(400).json({
        message: 'Choose a date within the next 90 days.',
      })
      return
    }

    const scanStart = anchor.getTime() - day
    const scanEnd = anchor.getTime() + 2 * day

    try {
      // Read eligibility, schedule, and reservations from one snapshot.
      const snapshot = await prisma.$transaction(
        async (tx) => {
          const owner = await tx.user.findUnique({
            where: { id: ownerId },
            select: { role: true, status: true },
          })

          if (!owner || owner.status !== 'ACTIVE') {
            throw new SlotLookupError(401, 'Please sign in again.')
          }

          if (owner.role !== 'OWNER') {
            throw new SlotLookupError(
              403,
              'An owner account is required.',
            )
          }

          const pet = await tx.pet.findFirst({
            where: { id: petId, ownerId },
            select: { species: true },
          })

          if (!pet) {
            throw new SlotLookupError(404, 'Pet profile not found.')
          }

          const vet = await tx.vetListing.findFirst({
            where: {
              AND: [
                publicVetFilter(),
                {
                  id,
                  bookingEnabled: true,
                  user: {
                    is: {
                      role: 'VET',
                      status: 'ACTIVE',
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              userId: true,
              timeZone: true,
              isDemo: true,
              species: true,
              availabilityEnabled: true,
              verificationEvidenceReferences: true,
              availabilityWindows: {
                select: {
                  weekday: true,
                  startMinute: true,
                  endMinute: true,
                },
              },
            },
          })

          if (
            !vet ||
            !vet.userId ||
            (
              !vet.isDemo &&
              !vet.verificationEvidenceReferences?.trim()
            )
          ) {
            throw new SlotLookupError(
              409,
              'This clinic is not currently accepting requests.',
            )
          }

          if (!vet.species.includes(pet.species)) {
            throw new SlotLookupError(
              400,
              'This clinic does not support your pet’s species.',
            )
          }

          if (!vet.availabilityEnabled) {
            throw new SlotLookupError(
              409,
              'This clinic has not activated its schedule. Use the manual request form.',
            )
          }

          const blocks = await tx.vetAvailabilityBlock.findMany({
            where: {
              vetListingId: id,
              startsAt: { lt: new Date(scanEnd) },
              endsAt: { gt: new Date(scanStart) },
            },
            take: 501,
            select: {
              startsAt: true,
              endsAt: true,
            },
          })

          const reservations = await tx.appointment.findMany({
            where: {
              status: {
                in: ['CONFIRMED', 'RESCHEDULE_PROPOSED'],
              },
              confirmedStartAt: { lt: new Date(scanEnd) },
              confirmedEndAt: { gt: new Date(scanStart) },
              OR: [
                { providerUserId: vet.userId },
                { vetListingId: id },
                { petId },
              ],
            },
            take: 501,
            select: {
              confirmedStartAt: true,
              confirmedEndAt: true,
            },
          })

          if (blocks.length > 500 || reservations.length > 500) {
            throw new SlotLookupError(
              409,
              'This date needs a larger availability review. Slots could not be calculated.',
            )
          }

          return { vet, blocks, reservations }
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      )

      let formatter: Intl.DateTimeFormat

      try {
        formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: snapshot.vet.timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
      } catch {
        throw new SlotLookupError(
          409,
          'The clinic time zone needs attention.',
        )
      }

      const weekdays: Record<string, number> = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
      }

      const minutes: {
        instant: number
        date: string
        localMinute: number
        covered: boolean
      }[] = []

      for (
        let instant = scanStart;
        instant < scanEnd;
        instant += minute
      ) {
        const parts = formatter.formatToParts(new Date(instant))
        const part = (type: string) =>
          parts.find((item) => item.type === type)?.value ?? ''

        const weekday = weekdays[part('weekday')]
        const localMinute =
          Number(part('hour')) * 60 + Number(part('minute'))

        minutes.push({
          instant,
          date: `${part('year')}-${part('month')}-${part('day')}`,
          localMinute,
          covered: snapshot.vet.availabilityWindows.some(
            (window) =>
              window.weekday === weekday &&
              localMinute >= window.startMinute &&
              localMinute < window.endMinute,
          ),
        })
      }

      const slots: {
        startsAt: string
        endsAt: string
      }[] = []

      for (let index = 0; index + 30 <= minutes.length; index += 1) {
        const candidate = minutes[index]!
        const start = candidate.instant
        const end = start + 30 * minute

        if (
          candidate.date !== date ||
          candidate.localMinute % 30 !== 0 ||
          start <= now.getTime() ||
          start > latestStart
        ) {
          continue
        }

        // Every occupied minute must fall within working hours.
        if (
          !minutes
            .slice(index, index + 30)
            .every((item) => item.covered)
        ) {
          continue
        }

        const blocked = snapshot.blocks.some(
          (block) =>
            block.startsAt.getTime() < end &&
            block.endsAt.getTime() > start,
        )

        const reserved = snapshot.reservations.some(
          (reservation) =>
            reservation.confirmedStartAt !== null &&
            reservation.confirmedEndAt !== null &&
            reservation.confirmedStartAt.getTime() < end &&
            reservation.confirmedEndAt.getTime() > start,
        )

        if (!blocked && !reserved) {
          slots.push({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
          })
        }
      }

      res.json({
        date,
        timeZone: snapshot.vet.timeZone,
        isDemo: snapshot.vet.isDemo,
        durationMinutes: 30,
        slots,
        checkedAt: now.toISOString(),
        message:
          'These times are not reserved. Provider confirmation is required.',
      })
    } catch (error) {
      if (error instanceof SlotLookupError) {
        res.status(error.statusCode).json({
          message: error.message,
        })
        return
      }

      next(error)
    }
  },
)
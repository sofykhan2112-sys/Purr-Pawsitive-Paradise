import { Router } from 'express'
import {
  ArticleTopic,
  Prisma,
} from './generated/prisma/client.js'
import { prisma } from './db.js'

export const articlesRouter = Router()

export function publicArticleFilter(): Prisma.ArticleWhereInput {
  const now = new Date()

  return {
    status: 'PUBLISHED',

    publishedAt: {
      lte: now,
    },

    AND: [
      {
        OR: [
          {
            reviewDueAt: null,
          },
          {
            reviewDueAt: {
              gt: now,
            },
          },
        ],
      },

      {
        OR: [
          {
            requiresClinicalReview: false,

            topic: {
              notIn: [
                'HEALTH',
                'PREVENTIVE_CARE',
                'RAPID_RELIEF',
              ],
            },
          },

          {
            reviewerName: {
              not: null,
            },

            reviewerCredentials: {
              not: null,
            },

            reviewedAt: {
              lte: now,
            },

            reviewDueAt: {
              gt: now,
            },

            sourceUrls: {
              isEmpty: false,
            },
          },
        ],
      },
    ],
  }
}

// ======================================================
// GET /api/articles
// ======================================================
//
// Examples:
//
// /api/articles?species=CAT&page=1
// /api/articles?species=DOG&q=nutrition&page=1
// /api/articles?species=TURTLE&topic=HABITAT&page=1
// /api/articles?species=DOG&breed=labrador-retriever&page=1
//
articlesRouter.get('/', async (req, res, next) => {
  const {
    species,
    q,
    page,
    topic,
    breed,
  } = req.query

  // ----------------------------------------------------
  // Validate topic
  // ----------------------------------------------------

  if (
    topic !== undefined &&
    (
      typeof topic !== 'string' ||
      !Object.values(ArticleTopic).includes(
        topic as ArticleTopic,
      )
    )
  ) {
    res.status(400).json({
      message: 'Choose a valid article topic.',
    })

    return
  }

  // ----------------------------------------------------
  // Validate species
  // ----------------------------------------------------

  if (
    species !== undefined &&
    species !== 'CAT' &&
    species !== 'DOG' &&
    species !== 'TURTLE'
  ) {
    res.status(400).json({
      message:
        'Species must be CAT, DOG, or TURTLE.',
    })

    return
  }

  // ----------------------------------------------------
  // Validate search
  // ----------------------------------------------------

  if (
    q !== undefined &&
    (
      typeof q !== 'string' ||
      q.length > 100
    )
  ) {
    res.status(400).json({
      message:
        'Search must be text with at most 100 characters.',
    })

    return
  }

  // ----------------------------------------------------
  // Validate breed/species record
  // ----------------------------------------------------

  if (
    breed !== undefined &&
    (
      typeof breed !== 'string' ||
      breed.length > 180
    )
  ) {
    res.status(400).json({
      message:
        'Breed or species filter is invalid.',
    })

    return
  }

  // ----------------------------------------------------
  // Validate page
  // ----------------------------------------------------

  if (
    page !== undefined &&
    (
      typeof page !== 'string' ||
      !/^[1-9]\d{0,4}$/.test(page)
    )
  ) {
    res.status(400).json({
      message:
        'Page must be a positive number up to 99999.',
    })

    return
  }

  const pageNumber =
    page === undefined
      ? 1
      : Number(page)

  const pageSize = 12

  const search =
    typeof q === 'string'
      ? q.trim()
      : ''

  const breedSlug =
    typeof breed === 'string'
      ? breed.trim()
      : ''

  try {
    const conditions: Prisma.ArticleWhereInput[] = [
      publicArticleFilter(),
    ]

    // --------------------------------------------------
    // Species filter
    // --------------------------------------------------

    if (species !== undefined) {
      conditions.push({
        species,
      })
    }

    // --------------------------------------------------
    // Topic filter
    // --------------------------------------------------

    if (typeof topic === 'string') {
      conditions.push({
        topic: topic as ArticleTopic,
      })
    }

    // --------------------------------------------------
    // Keyword search
    // --------------------------------------------------

    if (search) {
      const matchingRecords =
        await prisma.breedSpeciesRecord.findMany({
          where: {
            ...(typeof species === 'string'
              ? {
                  petGroup: species,
                }
              : {}),

            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },

              {
                slug: {
                  contains: search.toLowerCase(),
                  mode: 'insensitive',
                },
              },

              {
                characteristics: {
                  contains: search,
                  mode: 'insensitive',
                },
              },

              {
                careSummary: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          },

          select: {
            articleSlugs: true,
          },
        })

      const linkedSlugs = Array.from(
        new Set(
          matchingRecords
            .flatMap(
              (record) =>
                record.articleSlugs,
            )
            .filter(
              (value) =>
                value.length > 0,
            ),
        ),
      )

      conditions.push({
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            summary: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            body: {
              contains: search,
              mode: 'insensitive',
            },
          },

          ...(linkedSlugs.length > 0
            ? [
                {
                  slug: {
                    in: linkedSlugs,
                  },
                } satisfies Prisma.ArticleWhereInput,
              ]
            : []),
        ],
      })
    }

    // --------------------------------------------------
    // Exact breed/species filter
    // --------------------------------------------------

    if (breedSlug) {
      const record =
        await prisma.breedSpeciesRecord.findFirst({
          where: {
            slug: breedSlug,

            ...(typeof species === 'string'
              ? {
                  petGroup: species,
                }
              : {}),
          },

          select: {
            articleSlugs: true,
          },
        })

      if (
        !record ||
        record.articleSlugs.length === 0
      ) {
        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          articles: [],
          total: 0,
          page: pageNumber,
          pageSize,
          totalPages: 0,
        })

        return
      }

      conditions.push({
        slug: {
          in: record.articleSlugs,
        },
      })
    }

    const where: Prisma.ArticleWhereInput = {
      AND: conditions,
    }

    // --------------------------------------------------
    // Load articles + count
    // --------------------------------------------------

    const [
      articles,
      total,
    ] = await prisma.$transaction([
      prisma.article.findMany({
        where,

        orderBy: [
          {
            publishedAt: 'desc',
          },
          {
            id: 'asc',
          },
        ],

        skip:
          (pageNumber - 1) *
          pageSize,

        take: pageSize,

        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,

          imageUrl: true,
          imageAlt: true,
          imageRights: true,

          species: true,
          topic: true,

          reviewerName: true,
          reviewedAt: true,
          publishedAt: true,
        },
      }),

      prisma.article.count({
        where,
      }),
    ])

    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    res.json({
      articles,
      total,
      page: pageNumber,
      pageSize,
      totalPages:
        Math.ceil(
          total / pageSize,
        ),
    })
  } catch (error) {
    next(error)
  }
})

// ======================================================
// GET /api/articles/:slug
// ======================================================

articlesRouter.get(
  '/:slug',
  async (
    req,
    res,
    next,
  ) => {
    const slug =
      req.params.slug

    // --------------------------------------------------
    // Validate slug
    // --------------------------------------------------

    if (
      typeof slug !== 'string' ||
      slug.length > 180 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        slug,
      )
    ) {
      res.status(400).json({
        message:
          'Invalid article address.',
      })

      return
    }

    try {
      // ------------------------------------------------
      // Load the requested published article
      // ------------------------------------------------

      const article =
        await prisma.article.findFirst({
          where: {
            AND: [
              publicArticleFilter(),
              {
                slug,
              },
            ],
          },

          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            body: true,

            imageUrl: true,
            imageAlt: true,
            imageRights: true,

            species: true,
            topic: true,

            sourceUrls: true,

            reviewerName: true,
            reviewerCredentials: true,
            reviewedAt: true,
            reviewDueAt: true,

            publishedAt: true,
          },
        })

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      if (!article) {
        res.status(404).json({
          message:
            'Article not found.',
        })

        return
      }

      // ------------------------------------------------
      // Related articles
      //
      // Only show other public articles for the same
      // pet group.
      // ------------------------------------------------

      const relatedArticles =
        await prisma.article.findMany({
          where: {
            AND: [
              publicArticleFilter(),

              {
                species:
                  article.species,
              },

              {
                slug: {
                  not:
                    article.slug,
                },
              },
            ],
          },

          orderBy: [
            {
              publishedAt:
                'desc',
            },

            {
              title:
                'asc',
            },
          ],

          take: 3,

          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            species: true,
            topic: true,
          },
        })

      res.json({
        article: {
          ...article,
          relatedArticles,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)
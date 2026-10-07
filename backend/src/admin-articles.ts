import { Router } from 'express'

import {

  ArticleTopic,

  Species,

  Prisma,

} from './generated/prisma/client.js'

import { prisma } from './db.js'

import { publicArticleFilter } from './articles.js'

import type {} from './auth.js'

export const adminArticlesRouter = Router()

// Check the current database role on every request.

adminArticlesRouter.use(async (req, res, next) => {

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

      res.status(401).json({ message: 'Please sign in again.' })

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

// Protect requests that change content.

adminArticlesRouter.use((req, res, next) => {

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {

    const allowedOrigin =

      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (origin && origin !== allowedOrigin) {

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

// GET /api/admin/articles?page=1

// Admins can see drafts, published articles, and archived articles.

adminArticlesRouter.get('/', async (req, res, next) => {

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

    const [articles, total] = await prisma.$transaction([

      prisma.article.findMany({

        orderBy: [

          { updatedAt: 'desc' },

          { id: 'asc' },

        ],

        skip: (pageNumber - 1) * pageSize,

        take: pageSize,

        select: {

          id: true,

          slug: true,

          title: true,

          summary: true,

          species: true,

          topic: true,

          status: true,

          requiresClinicalReview: true,

          updatedAt: true,

        },

      }),

      prisma.article.count(),

    ])

    res.json({

      articles,

      total,

      page: pageNumber,

      pageSize,

      totalPages: Math.ceil(total / pageSize),

    })

  } catch (error) {

    next(error)

  }

})


function validateArticleImageMetadata(input: {
  imageUrl?: unknown
  imageAlt?: unknown
  imageRights?: unknown
}):
  | {
      ok: true
      imageUrl: string | null
      imageAlt: string | null
      imageRights: string | null
    }
  | {
      ok: false
      message: string
    } {
  const rawUrl =
    typeof input.imageUrl === 'string'
      ? input.imageUrl.trim()
      : ''

  const rawAlt =
    typeof input.imageAlt === 'string'
      ? input.imageAlt.trim()
      : ''

  const rawRights =
    typeof input.imageRights === 'string'
      ? input.imageRights.trim()
      : ''

  const hasAny =
    rawUrl.length > 0 ||
    rawAlt.length > 0 ||
    rawRights.length > 0

  if (!hasAny) {
    return {
      ok: true,
      imageUrl: null,
      imageAlt: null,
      imageRights: null,
    }
  }

  if (!rawUrl || !rawAlt || !rawRights) {
    return {
      ok: false,
      message:
        'When an article image is used, image URL, alt text, and image rights/permission information are all required.',
    }
  }

  if (rawUrl.length > 2048) {
    return {
      ok: false,
      message:
        'Article image URL must be at most 2,048 characters.',
    }
  }

  try {
    const url = new URL(rawUrl)

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error('Invalid image URL')
    }
  } catch {
    return {
      ok: false,
      message:
        'Article image URL must be a valid HTTP or HTTPS link.',
    }
  }

  if (rawAlt.length < 5 || rawAlt.length > 300) {
    return {
      ok: false,
      message:
        'Image alt text must contain 5–300 characters.',
    }
  }

  if (rawRights.length < 5 || rawRights.length > 1000) {
    return {
      ok: false,
      message:
        'Image rights/permission information must contain 5–1,000 characters.',
    }
  }

  return {
    ok: true,
    imageUrl: rawUrl,
    imageAlt: rawAlt,
    imageRights: rawRights,
  }
}

// POST /api/admin/articles

// Public input cannot set publication status or review approval.

adminArticlesRouter.post('/', async (req, res, next) => {

  const input = req.body

  if (

    !input ||

    typeof input.title !== 'string' ||

    typeof input.slug !== 'string' ||

    typeof input.summary !== 'string' ||

    typeof input.body !== 'string' ||

    typeof input.species !== 'string' ||

    typeof input.topic !== 'string'

  ) {

    res.status(400).json({

      message: 'Title, slug, summary, body, species, and topic are required.',

    })

    return

  }

  const title = input.title.trim()

  const slug = input.slug.trim().toLowerCase()

  const summary = input.summary.trim()

  const body = input.body.trim()

  if (title.length < 3 || title.length > 180) {

    res.status(400).json({

      message: 'Title must contain 3–180 characters.',

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

        'Slug must contain 3–180 characters: lowercase letters, numbers, and single hyphens between words.',

    })

    return

  }

  if (summary.length < 10 || summary.length > 500) {

    res.status(400).json({

      message: 'Summary must contain 10–500 characters.',

    })

    return

  }

  if (body.length < 20 || body.length > 20000) {

    res.status(400).json({

      message: 'Article body must contain 20–20,000 characters.',

    })

    return

  }

  if (!Object.values(Species).includes(input.species as Species)) {

    res.status(400).json({

      message: 'Choose CAT, DOG, or TURTLE.',

    })

    return

  }

  if (!Object.values(ArticleTopic).includes(input.topic as ArticleTopic)) {

    res.status(400).json({

      message: 'Choose a valid article topic.',

    })

    return

  }

  const sources = input.sourceUrls ?? []

  if (

    !Array.isArray(sources) ||

    sources.length > 20 ||

    sources.some(

      (source: unknown) =>

        typeof source !== 'string' || source.length > 2000,

    )

  ) {

    res.status(400).json({

      message: 'Provide up to 20 source URLs, each at most 2,000 characters.',

    })

    return

  }

  const sourceUrls: string[] = []

  for (const source of sources) {

    try {

      const url = new URL(source.trim())

      if (

        !['https:', 'http:'].includes(url.protocol) ||

        url.username ||

        url.password

      ) {

        throw new Error('Invalid source URL')

      }

      sourceUrls.push(url.href)

    } catch {

      res.status(400).json({

        message: 'Each source must be a valid HTTP or HTTPS link.',

      })

      return

    }

  }

  try {

    const article = await prisma.$transaction(async (tx) => {

      const created = await tx.article.create({

        data: {

          title,

          slug,

          summary,

          body,

          species: input.species as Species,

          topic: input.topic as ArticleTopic,

          sourceUrls: [...new Set(sourceUrls)],

          status: 'DRAFT',

          // New content starts requiring review.

          // The review workflow will assess its requirements.

          requiresClinicalReview: true,

        },

        select: {

          id: true,

          title: true,

          slug: true,

          status: true,

        },

      })

      await tx.auditEvent.create({

        data: {

          actorId: req.session.userId!,

          actorLabel: 'Authenticated administrator',

          action: 'ARTICLE_DRAFT_CREATED',

          entityType: 'Article',

          entityId: created.id,

          details: {

            slug: created.slug,

            status: created.status,

          },

        },

      })

      return created

    })

    res.status(201).json({

      message: 'Article draft created successfully.',

      article,

    })

  } catch (error) {

    if (

      error instanceof Prisma.PrismaClientKnownRequestError &&

      error.code === 'P2002'

    ) {

      res.status(409).json({

        message: 'An article with this slug already exists.',

      })

      return

    }

    next(error)

  }

})

function validArticleId(id: unknown): id is string {

    return (

      typeof id === 'string' &&

      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    )

  }

  
// GET /api/admin/articles/coverage
//
// Shows the FR02 content matrix for cats, dogs, and turtles.
// Counts only articles that are currently eligible for public display
// as "published coverage", while also showing total editorial records.
adminArticlesRouter.get('/coverage', async (_req, res, next) => {
  const matrix = [
    {
      species: 'CAT' as const,
      topics: [
        {
          topic: 'BREEDS_AND_SPECIES' as const,
          label: 'Breeds & personalities',
          applicable: true,
          note: null,
        },
        {
          topic: 'DAILY_CARE' as const,
          label: 'Everyday care',
          applicable: true,
          note: null,
        },
        {
          topic: 'NUTRITION' as const,
          label: 'Food & nutrition',
          applicable: true,
          note: null,
        },
        {
          topic: 'GROOMING' as const,
          label: 'Grooming',
          applicable: true,
          note: null,
        },
        {
          topic: 'HABITAT' as const,
          label: 'Habitat',
          applicable: false,
          note:
            'For cats, home-environment guidance is covered through everyday care and enrichment rather than a separate habitat requirement.',
        },
        {
          topic: 'ENRICHMENT' as const,
          label: 'Play & enrichment',
          applicable: true,
          note: null,
        },
        {
          topic: 'PREVENTIVE_CARE' as const,
          label: 'Preventive care & vaccination awareness',
          applicable: true,
          note: null,
        },
        {
          topic: 'HEALTH' as const,
          label: 'Health awareness',
          applicable: true,
          note: null,
        },
      ],
    },
    {
      species: 'DOG' as const,
      topics: [
        {
          topic: 'BREEDS_AND_SPECIES' as const,
          label: 'Breeds & personalities',
          applicable: true,
          note: null,
        },
        {
          topic: 'DAILY_CARE' as const,
          label: 'Everyday care',
          applicable: true,
          note: null,
        },
        {
          topic: 'NUTRITION' as const,
          label: 'Food & nutrition',
          applicable: true,
          note: null,
        },
        {
          topic: 'GROOMING' as const,
          label: 'Grooming',
          applicable: true,
          note: null,
        },
        {
          topic: 'HABITAT' as const,
          label: 'Habitat',
          applicable: false,
          note:
            'For dogs, living-environment guidance is covered through everyday care and enrichment rather than a separate habitat requirement.',
        },
        {
          topic: 'ENRICHMENT' as const,
          label: 'Activity & enrichment',
          applicable: true,
          note: null,
        },
        {
          topic: 'PREVENTIVE_CARE' as const,
          label: 'Preventive care & vaccination awareness',
          applicable: true,
          note: null,
        },
        {
          topic: 'HEALTH' as const,
          label: 'Health awareness',
          applicable: true,
          note: null,
        },
      ],
    },
    {
      species: 'TURTLE' as const,
      topics: [
        {
          topic: 'BREEDS_AND_SPECIES' as const,
          label: 'Species & types',
          applicable: true,
          note: null,
        },
        {
          topic: 'DAILY_CARE' as const,
          label: 'Hygiene & handling',
          applicable: true,
          note:
            'The general daily-care topic is used for hygiene, handling, and routine husbandry.',
        },
        {
          topic: 'NUTRITION' as const,
          label: 'Food & nutrition',
          applicable: true,
          note: null,
        },
        {
          topic: 'GROOMING' as const,
          label: 'Grooming',
          applicable: false,
          note:
            'A separate grooming topic is not applicable to turtles; hygiene and handling are covered under daily care.',
        },
        {
          topic: 'HABITAT' as const,
          label: 'Habitat, lighting & temperature',
          applicable: true,
          note:
            'Habitat coverage should include species-appropriate environmental, lighting, and temperature requirements.',
        },
        {
          topic: 'ENRICHMENT' as const,
          label: 'Enrichment',
          applicable: false,
          note:
            'For the MVP matrix, species-specific environmental needs are covered within habitat rather than forcing a dog/cat enrichment template.',
        },
        {
          topic: 'PREVENTIVE_CARE' as const,
          label: 'Preventive care',
          applicable: true,
          note:
            'Vaccination information is included only where applicable to the species and care context.',
        },
        {
          topic: 'HEALTH' as const,
          label: 'Health awareness',
          applicable: true,
          note: null,
        },
      ],
    },
  ]

  try {
    const [allGroups, publicGroups] = await Promise.all([
      prisma.article.groupBy({
        by: ['species', 'topic', 'status'],
        _count: {
          _all: true,
        },
      }),

      prisma.article.groupBy({
        by: ['species', 'topic'],
        where: publicArticleFilter(),
        _count: {
          _all: true,
        },
      }),
    ])

    const rows = matrix.map((group) => {
      const topics = group.topics.map((entry) => {
        const publicMatch = publicGroups.find(
          (item) =>
            item.species === group.species &&
            item.topic === entry.topic,
        )

        const editorialMatches = allGroups.filter(
          (item) =>
            item.species === group.species &&
            item.topic === entry.topic,
        )

        const statusCounts = {
          DRAFT: 0,
          IN_REVIEW: 0,
          PUBLISHED: 0,
          ARCHIVED: 0,
        }

        for (const match of editorialMatches) {
          statusCounts[match.status] = match._count._all
        }

        const publicCount = publicMatch?._count._all ?? 0

        return {
          ...entry,
          publicCount,
          statusCounts,
          complete:
            !entry.applicable || publicCount > 0,
        }
      })

      const applicableTopics = topics.filter(
        (topic) => topic.applicable,
      )

      const completedTopics = applicableTopics.filter(
        (topic) => topic.publicCount > 0,
      )

      return {
        species: group.species,
        topics,
        applicableCount: applicableTopics.length,
        completedCount: completedTopics.length,
        complete:
          applicableTopics.length === completedTopics.length,
      }
    })

    const applicableCount = rows.reduce(
      (sum, group) => sum + group.applicableCount,
      0,
    )

    const completedCount = rows.reduce(
      (sum, group) => sum + group.completedCount,
      0,
    )

    res.json({
      rows,
      summary: {
        applicableCount,
        completedCount,
        missingCount:
          applicableCount - completedCount,
        complete:
          applicableCount === completedCount,
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/articles/:id

adminArticlesRouter.get('/:id', async (req, res, next) => {
  const id = req.params.id

  if (!validArticleId(id)) {
    res.status(400).json({ message: 'Invalid article ID.' })
    return
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id },
    })

    if (!article) {
      res.status(404).json({ message: 'Article not found.' })
      return
    }

    const linkedRecords = await prisma.breedSpeciesRecord.findMany({
      where: {
        articleSlugs: {
          has: article.slug,
        },
      },
      orderBy: [
        { petGroup: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
      },
    })

    res.json({
      article: {
        ...article,
        relatedBreedRecordIds: linkedRecords.map((record) => record.id),
      },
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/articles/:id

// Only drafts can be edited through this endpoint.

adminArticlesRouter.put('/:id', async (req, res, next) => {

    const id = req.params.id

    const input = req.body

    if (!validArticleId(id)) {

      res.status(400).json({ message: 'Invalid article ID.' })

      return

    }

    if (

      !input ||

      typeof input.title !== 'string' ||

      typeof input.summary !== 'string' ||

      typeof input.body !== 'string' ||

      typeof input.species !== 'string' ||

      typeof input.topic !== 'string' ||

      typeof input.updatedAt !== 'string' ||

      !Array.isArray(input.relatedBreedRecordIds)

    ) {

      res.status(400).json({

        message:
          'Title, summary, body, species, topic, related breed/species records, and version are required.',

      })

      return

    }

    const title = input.title.trim()

    const summary = input.summary.trim()

    const body = input.body.trim()

    const version = new Date(input.updatedAt)

    if (Number.isNaN(version.getTime())) {

      res.status(400).json({

        message: 'Invalid article version. Reload the article.',

      })

      return

    }

    if (title.length < 3 || title.length > 180) {

      res.status(400).json({

        message: 'Title must contain 3–180 characters.',

      })

      return

    }

    if (summary.length < 10 || summary.length > 500) {

      res.status(400).json({

        message: 'Summary must contain 10–500 characters.',

      })

      return

    }

    if (body.length < 20 || body.length > 20000) {

      res.status(400).json({

        message: 'Article body must contain 20–20,000 characters.',

      })

      return

    }

    if (!Object.values(Species).includes(input.species as Species)) {

      res.status(400).json({ message: 'Choose a valid pet group.' })

      return

    }

    if (!Object.values(ArticleTopic).includes(input.topic as ArticleTopic)) {

      res.status(400).json({ message: 'Choose a valid article topic.' })

      return

    }

    if (
      input.relatedBreedRecordIds.length > 100 ||
      input.relatedBreedRecordIds.some(
        (recordId: unknown) => !validArticleId(recordId),
      )
    ) {
      res.status(400).json({
        message:
          'Related breed/species records must contain valid record IDs.',
      })
      return
    }

    const relatedBreedRecordIds = [
      ...new Set(input.relatedBreedRecordIds as string[]),
    ]

    // Require this field so missing input cannot silently erase sources.

    if (

      !Array.isArray(input.sourceUrls) ||

      input.sourceUrls.length > 20 ||

      input.sourceUrls.some(

        (source: unknown) =>

          typeof source !== 'string' || source.length > 2000,

      )

    ) {

      res.status(400).json({

        message: 'Provide a source list containing up to 20 valid links.',

      })

      return

    }

    const sourceUrls: string[] = []

    for (const source of input.sourceUrls) {

      try {

        const url = new URL(source.trim())

        if (

          !['http:', 'https:'].includes(url.protocol) ||

          url.username ||

          url.password

        ) {

          throw new Error('Invalid URL')

        }

        sourceUrls.push(url.href)

      } catch {

        res.status(400).json({

          message: 'Each source must be a valid HTTP or HTTPS link.',

        })

        return

      }

    }

    const imageMetadata = validateArticleImageMetadata({
      imageUrl: input.imageUrl,
      imageAlt: input.imageAlt,
      imageRights: input.imageRights,
    })

    if (!imageMetadata.ok) {
      res.status(400).json({
        message: imageMetadata.message,
      })
      return
    }

    if (relatedBreedRecordIds.length > 0) {
      const validRelatedCount = await prisma.breedSpeciesRecord.count({
        where: {
          id: {
            in: relatedBreedRecordIds,
          },
          petGroup: input.species as Species,
        },
      })

      if (validRelatedCount !== relatedBreedRecordIds.length) {
        res.status(400).json({
          message:
            'Choose only breed/species records that belong to the selected pet group.',
        })
        return
      }
    }

    try {

      const article = await prisma.$transaction(async (tx) => {

        const result = await tx.article.updateMany({

          where: {

            id,

            status: 'DRAFT',

            updatedAt: version,

          },

          data: {

            title,

            summary,

            body,

            species: input.species as Species,

            topic: input.topic as ArticleTopic,

            sourceUrls: [...new Set(sourceUrls)],

            imageUrl: imageMetadata.imageUrl,
            imageAlt: imageMetadata.imageAlt,
            imageRights: imageMetadata.imageRights,

            // Edited content must go through review again.

            requiresClinicalReview: true,

            reviewerName: null,

            reviewerCredentials: null,

            reviewedAt: null,

            reviewDueAt: null,

            publishedAt: null,

          },

        })

        if (result.count === 0) return null

        const savedArticle = await tx.article.findUnique({
          where: { id },
        })

        if (!savedArticle) return null

        const recordsToCheck = await tx.breedSpeciesRecord.findMany({
          where: {
            OR: [
              {
                petGroup: input.species as Species,
              },
              {
                articleSlugs: {
                  has: savedArticle.slug,
                },
              },
            ],
          },
          select: {
            id: true,
            articleSlugs: true,
          },
        })

        const selectedRecordIds = new Set(relatedBreedRecordIds)

        for (const record of recordsToCheck) {
          const shouldBeLinked = selectedRecordIds.has(record.id)
          const isLinked = record.articleSlugs.includes(savedArticle.slug)

          if (shouldBeLinked === isLinked) {
            continue
          }

          const nextArticleSlugs = shouldBeLinked
            ? [...new Set([...record.articleSlugs, savedArticle.slug])]
            : record.articleSlugs.filter(
                (articleSlug) => articleSlug !== savedArticle.slug,
              )

          await tx.breedSpeciesRecord.update({
            where: { id: record.id },
            data: {
              articleSlugs: {
                set: nextArticleSlugs,
              },
            },
          })
        }

        await tx.auditEvent.create({

          data: {

            actorId: req.session.userId!,

            actorLabel: 'Authenticated administrator',

            action: 'ARTICLE_DRAFT_UPDATED',

            entityType: 'Article',

            entityId: id,

            details: {
              relatedBreedRecordIds,
              hasArticleImage: imageMetadata.imageUrl !== null,
            },

          },

        })

        return {
          ...savedArticle,
          relatedBreedRecordIds,
        }

      })

      if (!article) {

        res.status(409).json({

          message:

            'This article is no longer an editable draft, has changed, or is unavailable. Reload it before continuing.',

        })

        return

      }

      res.json({

        message: 'Draft updated successfully.',

        article,

      })

    } catch (error) {

      next(error)

    }

  })

  // POST /api/admin/articles/:id/submit-review

adminArticlesRouter.post('/:id/submit-review', async (req, res, next) => {

    const id = req.params.id

    const updatedAt = req.body?.updatedAt

    if (!validArticleId(id)) {

      res.status(400).json({ message: 'Invalid article ID.' })

      return

    }

    if (

      typeof updatedAt !== 'string' ||

      Number.isNaN(new Date(updatedAt).getTime())

    ) {

      res.status(400).json({

        message: 'Provide the article version. Reload the article.',

      })

      return

    }

    try {

      const article = await prisma.$transaction(async (tx) => {

        const result = await tx.article.updateMany({

          where: {

            id,

            status: 'DRAFT',

            updatedAt: new Date(updatedAt),

          },

          data: {

            status: 'IN_REVIEW',

          },

        })

        if (result.count === 0) return null

        await tx.auditEvent.create({

          data: {

            actorId: req.session.userId!,

            actorLabel: 'Authenticated administrator',

            action: 'ARTICLE_SUBMITTED_FOR_REVIEW',

            entityType: 'Article',

            entityId: id,

            details: {

              previousStatus: 'DRAFT',

              newStatus: 'IN_REVIEW',

            },

          },

        })

        return tx.article.findUnique({

          where: { id },

        })

      })

      if (!article) {

        res.status(409).json({

          message:

            'This article has changed or is no longer a draft. Reload it before continuing.',

        })

        return

      }

      res.json({

        message: 'Article submitted for review. It is not public yet.',

        article,

      })

    } catch (error) {

      next(error)

    }

  })

  // POST /api/admin/articles/:id/transition

adminArticlesRouter.post('/:id/transition', async (req, res, next) => {

    const id = req.params.id

    const { action, updatedAt, reason } = req.body ?? {}

    if (!validArticleId(id)) {

      res.status(400).json({ message: 'Invalid article ID.' })

      return

    }

    if (action !== 'RETURN_TO_DRAFT' && action !== 'ARCHIVE') {

      res.status(400).json({ message: 'Invalid article action.' })

      return

    }

    if (

      typeof updatedAt !== 'string' ||

      Number.isNaN(new Date(updatedAt).getTime())

    ) {

      res.status(400).json({

        message: 'Provide the current article version.',

      })

      return

    }

    if (

      typeof reason !== 'string' ||

      reason.trim().length < 5 ||

      reason.trim().length > 500

    ) {

      res.status(400).json({

        message: 'Provide a reason containing 5–500 characters.',

      })

      return

    }

    try {

      const article = await prisma.$transaction(async (tx) => {

        const existing = await tx.article.findUnique({

          where: { id },

          select: {

            status: true,

            updatedAt: true,

          },

        })

        if (!existing) return null

        const canTransition =

          action === 'RETURN_TO_DRAFT'

            ? existing.status !== 'DRAFT'

            : existing.status !== 'ARCHIVED'

        if (

          !canTransition ||

          existing.updatedAt.getTime() !== new Date(updatedAt).getTime()

        ) {

          return null

        }

        const changes: Prisma.ArticleUpdateManyMutationInput =

          action === 'RETURN_TO_DRAFT'

            ? {

                status: 'DRAFT',

                requiresClinicalReview: true,

                reviewerName: null,

                reviewerCredentials: null,

                reviewedAt: null,

                reviewDueAt: null,

                publishedAt: null,

              }

            : {

                status: 'ARCHIVED',

              }

        const result = await tx.article.updateMany({

          where: {

            id,

            status: existing.status,

            updatedAt: existing.updatedAt,

          },

          data: changes,

        })

        if (result.count === 0) return null

        await tx.auditEvent.create({

          data: {

            actorId: req.session.userId!,

            actorLabel: 'Authenticated administrator',

            action:

              action === 'RETURN_TO_DRAFT'

                ? 'ARTICLE_RETURNED_TO_DRAFT'

                : 'ARTICLE_ARCHIVED',

            entityType: 'Article',

            entityId: id,

            details: {

              previousStatus: existing.status,

              newStatus:

                action === 'RETURN_TO_DRAFT' ? 'DRAFT' : 'ARCHIVED',

              reason: reason.trim(),

            },

          },

        })

        return tx.article.findUnique({

          where: { id },

        })

      })

      if (!article) {

        res.status(409).json({

          message:

            'This article has changed, is unavailable, or cannot make this transition. Reload it.',

        })

        return

      }

      res.json({

        message:

          action === 'RETURN_TO_DRAFT'

            ? 'Article returned to draft. It is not public.'

            : 'Article archived. It is not public.',

        article,

      })

    } catch (error) {

      next(error)

    }

  })

  // POST /api/admin/articles/:id/publish

adminArticlesRouter.post('/:id/publish', async (req, res, next) => {

  const id = req.params.id

  const {

    updatedAt,

    reviewerName,

    reviewerCredentials,

    reviewedAt,

    reviewConfirmed,

  } = req.body ?? {}

  if (!validArticleId(id)) {

    res.status(400).json({ message: 'Invalid article ID.' })

    return

  }

  if (

    typeof updatedAt !== 'string' ||

    Number.isNaN(new Date(updatedAt).getTime())

  ) {

    res.status(400).json({

      message: 'Provide the current article version.',

    })

    return

  }

  if (

    typeof reviewerName !== 'string' ||

    reviewerName.trim().length < 2 ||

    reviewerName.trim().length > 150

  ) {

    res.status(400).json({

      message: 'Enter the actual reviewer’s name, using 2–150 characters.',

    })

    return

  }

  if (

    typeof reviewerCredentials !== 'string' ||

    reviewerCredentials.trim().length < 5 ||

    reviewerCredentials.trim().length > 250

  ) {

    res.status(400).json({

      message: 'Enter the reviewer’s qualifications, using 5–250 characters.',

    })

    return

  }

  if (

    typeof reviewedAt !== 'string' ||

    !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)

  ) {

    res.status(400).json({

      message: 'Provide the review date as YYYY-MM-DD.',

    })

    return

  }

  const reviewDate = new Date(`${reviewedAt}T00:00:00.000Z`)

  const now = new Date()

  if (

    Number.isNaN(reviewDate.getTime()) ||

    reviewDate.toISOString().slice(0, 10) !== reviewedAt ||

    reviewDate > now

  ) {

    res.status(400).json({

      message: 'The review date must be valid and cannot be in the future.',

    })

    return

  }

  // Initial review policy: review again within 180 days.

  const reviewDueAt = new Date(

    reviewDate.getTime() + 180 * 24 * 60 * 60 * 1000,

  )

  if (reviewDueAt <= now) {

    res.status(400).json({

      message: 'This review is overdue. Obtain a new review before publishing.',

    })

    return

  }

  if (reviewConfirmed !== true) {

    res.status(400).json({

      message:

        'Confirm that the named qualified reviewer approved this exact saved version and its sources.',

    })

    return

  }

  try {

    const result = await prisma.$transaction(async (tx) => {

      const existing = await tx.article.findUnique({

        where: { id },

      })

      if (

        !existing ||

        existing.status !== 'IN_REVIEW' ||

        existing.updatedAt.getTime() !== new Date(updatedAt).getTime()

      ) {

        return {

          kind: 'conflict' as const,

        }

      }

      const imageMetadata =
        validateArticleImageMetadata({
          imageUrl: existing.imageUrl,
          imageAlt: existing.imageAlt,
          imageRights: existing.imageRights,
        })

      if (!imageMetadata.ok) {
        return {
          kind: 'invalid-image-metadata' as const,
          message: imageMetadata.message,
        }
      }

      const sourcesValid =

        existing.sourceUrls.length > 0 &&

        existing.sourceUrls.every((source) => {

          try {

            const url = new URL(source)

            return (

              ['https:', 'http:'].includes(url.protocol) &&

              !url.username &&

              !url.password

            )

          } catch {

            return false

          }

        })

      if (!sourcesValid) {

        return {

          kind: 'missing-sources' as const,

        }

      }

      const published = await tx.article.updateMany({

        where: {

          id,

          status: 'IN_REVIEW',

          updatedAt: existing.updatedAt,

        },

        data: {

          status: 'PUBLISHED',

          reviewerName: reviewerName.trim(),

          reviewerCredentials: reviewerCredentials.trim(),

          reviewedAt: reviewDate,

          reviewDueAt,

          publishedAt: now,

        },

      })

      if (published.count === 0) {

        return {

          kind: 'conflict' as const,

        }

      }

      await tx.auditEvent.create({

        data: {

          actorId: req.session.userId!,

          actorLabel: 'Authenticated administrator',

          action: 'ARTICLE_REVIEW_RECORDED_AND_PUBLISHED',

          entityType: 'Article',

          entityId: id,

          details: {

            previousStatus: 'IN_REVIEW',

            newStatus: 'PUBLISHED',

            approvedVersion: existing.updatedAt.toISOString(),

            reviewerName: reviewerName.trim(),

            reviewerCredentials: reviewerCredentials.trim(),

            reviewedAt: reviewDate.toISOString(),

            reviewDueAt: reviewDueAt.toISOString(),

            sourceUrls: existing.sourceUrls,

            administratorConfirmedReview: true,

          },

        },

      })

      const article = await tx.article.findUnique({

        where: { id },

      })

      return {

        kind: 'published' as const,

        article,

      }

    })

    if (result.kind === 'conflict') {

      res.status(409).json({

        message:

          'The article has changed, is unavailable, or is not in review. Reload it.',

      })

      return

    }

    if (result.kind === 'invalid-image-metadata') {
      res.status(400).json({
        message: result.message,
      })
      return
    }

    if (result.kind === 'missing-sources') {

      res.status(400).json({

        message:

          'At least one valid source link is required. Return the article to draft, add its sources, then submit it for review again.',

      })

      return

    }

    res.json({

      message: 'Review recorded and article published.',

      article: result.article,

    })

  } catch (error) {

    next(error)

  }

})
import { Router } from 'express'
import { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import { publicArticleFilter } from './articles.js'
import type {} from './auth.js'

export const chatbotRouter = Router()

type ChatSpecies = 'CAT' | 'DOG' | 'TURTLE'

const allowedSpecies = new Set<ChatSpecies>([
  'CAT',
  'DOG',
  'TURTLE',
])

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const stopWords = new Set([
  'about',
  'after',
  'also',
  'been',
  'being',
  'can',
  'could',
  'does',
  'from',
  'have',
  'help',
  'into',
  'just',
  'like',
  'need',
  'should',
  'some',
  'tell',
  'that',
  'their',
  'there',
  'they',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'your',
  'cat',
  'cats',
  'dog',
  'dogs',
  'pet',
  'pets',
  'turtle',
  'turtles',
])

const urgentPatterns = [
  /\bnot breathing\b/i,
  /\bcan(?:not|'t) breathe\b/i,
  /\bdifficulty breathing\b/i,
  /\btrouble breathing\b/i,
  /\bunconscious\b/i,
  /\bcollapsed?\b/i,
  /\bseizure\b/i,
  /\bchoking\b/i,
  /\bsevere bleeding\b/i,
  /\bheavy bleeding\b/i,
  /\bpoison(?:ed|ing)?\b/i,
  /\btoxic\b/i,
  /\boverdose\b/i,
  /\bhit by (?:a )?car\b/i,
  /\broad accident\b/i,
  /\bsnake bite\b/i,
  /\bsnakebite\b/i,
]

const diagnosisPatterns = [
  /\bdiagnos(?:e|is)\b/i,
  /\bwhat disease\b/i,
  /\bwhat illness\b/i,
  /\bwhat is wrong with\b/i,
  /\bwhat's wrong with\b/i,
  /\bdoes my (?:cat|dog|turtle|pet) have\b/i,
  /\bis this (?:a )?(?:disease|infection|condition)\b/i,
]

const medicationPatterns = [
  /\bdosage\b/i,
  /\bdose\b/i,
  /\bhow many mg\b/i,
  /\bhow much medicine\b/i,
  /\bhow much medication\b/i,
  /\bparacetamol\b/i,
  /\bacetaminophen\b/i,
  /\bibuprofen\b/i,
  /\baspirin\b/i,
  /\bantibiotic\b/i,
  /\bprescri(?:be|ption)\b/i,
]

function containsPattern(
  value: string,
  patterns: RegExp[],
) {
  return patterns.some((pattern) =>
    pattern.test(value),
  )
}

function extractSearchTerms(question: string) {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .filter((word) => !stopWords.has(word))

  return [...new Set(words)].slice(0, 8)
}

function splitIntoParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph.replace(/\s+/g, ' ').trim(),
    )
    .filter(
      (paragraph) =>
        paragraph.length >= 40,
    )
}

function paragraphScore(
  paragraph: string,
  terms: string[],
) {
  const lower = paragraph.toLowerCase()

  return terms.reduce(
    (score, term) =>
      score +
      (
        lower.includes(
          term.toLowerCase(),
        )
          ? 1
          : 0
      ),
    0,
  )
}

function countOccurrences(
  text: string,
  term: string,
) {
  const haystack = text.toLowerCase()
  const needle = term.toLowerCase()

  if (!needle) return 0

  let count = 0
  let position = 0

  while (true) {
    const found = haystack.indexOf(
      needle,
      position,
    )

    if (found === -1) break

    count += 1
    position = found + needle.length
  }

  return count
}

function articleRelevanceScore(
  article: {
    title: string
    summary: string
    body: string
  },
  terms: string[],
  question: string,
) {
  let score = 0

  const title =
    article.title.toLowerCase()

  const summary =
    article.summary.toLowerCase()

  const body =
    article.body.toLowerCase()

  for (const term of terms) {
    score +=
      countOccurrences(title, term) * 8

    score +=
      countOccurrences(summary, term) * 4

    score +=
      Math.min(
        countOccurrences(body, term),
        5,
      ) * 1
  }

  const cleanQuestion = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleanQuestion.length >= 8) {
    if (title.includes(cleanQuestion)) {
      score += 30
    }

    if (summary.includes(cleanQuestion)) {
      score += 15
    }

    if (body.includes(cleanQuestion)) {
      score += 8
    }
  }

  return score
}

function shortenText(
  value: string,
  maxLength = 420,
) {
  const clean = value
    .replace(/\s+/g, ' ')
    .trim()

  if (clean.length <= maxLength) {
    return clean
  }

  const shortened = clean.slice(
    0,
    maxLength,
  )

  const lastSentence = Math.max(
    shortened.lastIndexOf('.'),
    shortened.lastIndexOf('!'),
    shortened.lastIndexOf('?'),
  )

  if (lastSentence >= 120) {
    return shortened
      .slice(0, lastSentence + 1)
      .trim()
  }

  const lastSpace =
    shortened.lastIndexOf(' ')

  return `${
    lastSpace > 0
      ? shortened.slice(0, lastSpace)
      : shortened
  }…`
}

function buildGroundedAnswer(
  articles: Array<{
    title: string
    summary: string
    body: string
  }>,
  terms: string[],
  petName?: string,
) {
  if (articles.length === 0) {
    return null
  }

  const candidates =
    articles.flatMap((article) => {
      const paragraphs =
        splitIntoParagraphs(
          article.body,
        )

      return paragraphs.map(
        (paragraph, index) => ({
          paragraph,
          title: article.title,
          index,
          score: paragraphScore(
            paragraph,
            terms,
          ),
        }),
      )
    })

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return a.index - b.index
  })

  const best = candidates[0]

  if (!best || best.score === 0) {
    const fallback = articles[0]

    return petName
      ? `For ${petName}, the reviewed guidance most relevant to your question is: ${shortenText(
          fallback.summary,
        )}`
      : `The reviewed guidance most relevant to your question says: ${shortenText(
          fallback.summary,
        )}`
  }

  return petName
    ? `For ${petName}, the reviewed guidance says: ${shortenText(
        best.paragraph,
      )}`
    : `Based on the reviewed guidance: ${shortenText(
        best.paragraph,
      )}`
}

function articleHref(
  species: ChatSpecies,
  topic: string,
  slug: string,
) {
  if (topic === 'RAPID_RELIEF') {
    return `/rapid-relief/${encodeURIComponent(
      slug,
    )}`
  }

  const speciesPath = {
    CAT: 'cats',
    DOG: 'dogs',
    TURTLE: 'turtles',
  }[species]

  return `/pets/${speciesPath}#article-collection`
}

function generalSpeciesHref(
  species: ChatSpecies | null,
) {
  if (species === 'CAT') {
    return '/pets/cats'
  }

  if (species === 'DOG') {
    return '/pets/dogs'
  }

  if (species === 'TURTLE') {
    return '/pets/turtles'
  }

  return '/'
}

// POST /api/chatbot/validate-sources
chatbotRouter.post(
  '/validate-sources',
  async (req, res, next) => {
    const ids = req.body?.ids

    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      ids.some(
        (id: unknown) =>
          typeof id !== 'string' ||
          !uuidPattern.test(id),
      )
    ) {
      res.status(400).json({
        message:
          'Source IDs must be an array of up to 20 valid article IDs.',
      })
      return
    }

    const uniqueIds = [
      ...new Set(ids as string[]),
    ]

    try {
      const articles =
        await prisma.article.findMany({
          where: {
            AND: [
              publicArticleFilter(),
              {
                id: {
                  in: uniqueIds,
                },
              },
            ],
          },
          select: {
            id: true,
          },
        })

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        availableIds: articles.map(
          (article) => article.id,
        ),
      })
    } catch (error) {
      next(error)
    }
  },
)

// DELETE /api/chatbot/conversation
//
// Chatbot transcripts are not persisted server-side in this MVP.
// The frontend stores the current conversation only in sessionStorage.
// This endpoint gives the client one explicit deletion/privacy route
// and confirms that there is no server transcript to retain.
chatbotRouter.delete(
  '/conversation',
  async (_req, res) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    res.json({
      message:
        'Conversation deleted. No server-side chatbot transcript is stored.',
      serverStoredMessages: 0,
    })
  },
)

// POST /api/chatbot
chatbotRouter.post(
  '/',
  async (req, res, next) => {
    const body = req.body ?? {}

    if (
      typeof body.question !== 'string' ||
      body.question.trim().length < 3 ||
      body.question.trim().length > 500
    ) {
      res.status(400).json({
        message:
          'Question must contain between 3 and 500 characters.',
      })
      return
    }

    if (
      body.species !== undefined &&
      body.species !== null &&
      (
        typeof body.species !== 'string' ||
        !allowedSpecies.has(
          body.species as ChatSpecies,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Species must be CAT, DOG, or TURTLE.',
      })
      return
    }

    if (
      body.petId !== undefined &&
      body.petId !== null &&
      (
        typeof body.petId !== 'string' ||
        !uuidPattern.test(body.petId)
      )
    ) {
      res.status(400).json({
        message:
          'Invalid pet selection.',
      })
      return
    }

    if (
      body.history !== undefined &&
      (
        !Array.isArray(body.history) ||
        body.history.length > 4 ||
        body.history.some(
          (item: unknown) =>
            typeof item !== 'string' ||
            item.trim().length < 3 ||
            item.trim().length > 500,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Conversation history must contain at most four valid questions.',
      })
      return
    }

    const question =
      body.question.trim()

    const history: string[] =
      Array.isArray(body.history)
        ? body.history.map(
            (item: string) =>
              item.trim(),
          )
        : []

    const requestedSpecies =
      typeof body.species === 'string'
        ? (
            body.species as ChatSpecies
          )
        : null

    const petId =
      typeof body.petId === 'string'
        ? body.petId
        : null

    try {
      let petContext: {
        id: string
        name: string
        species: ChatSpecies
        breedOrType: string | null
        ageGroup: string | null
      } | null = null

      if (petId) {
        const userId =
          req.session.userId

        if (!userId) {
          res.status(401).json({
            message:
              'Please sign in to use one of your pet profiles.',
          })
          return
        }

        const user =
          await prisma.user.findUnique({
            where: {
              id: userId,
            },
            select: {
              role: true,
              status: true,
            },
          })

        if (
          !user ||
          user.status !== 'ACTIVE'
        ) {
          res.status(401).json({
            message:
              'Please sign in with an active account.',
          })
          return
        }

        if (user.role !== 'OWNER') {
          res.status(403).json({
            message:
              'Pet-profile personalization is available to owner accounts.',
          })
          return
        }

        const pet =
          await prisma.pet.findFirst({
            where: {
              id: petId,
              ownerId: userId,
            },
            select: {
              id: true,
              name: true,
              species: true,
              breedOrType: true,
              ageGroup: true,
            },
          })

        if (!pet) {
          res.status(404).json({
            message:
              'That pet profile is not available.',
          })
          return
        }

        petContext = {
          ...pet,
          species:
            pet.species as ChatSpecies,
        }

        if (
          requestedSpecies &&
          requestedSpecies !==
            petContext.species
        ) {
          res.status(400).json({
            message:
              'The selected pet does not match the supplied species.',
          })
          return
        }
      }

      const species =
        petContext?.species ??
        requestedSpecies

      const urgent =
        containsPattern(
          question,
          urgentPatterns,
        )

      const diagnosisRequest =
        containsPattern(
          question,
          diagnosisPatterns,
        )

      const medicationRequest =
        containsPattern(
          question,
          medicationPatterns,
        )

      const currentTerms =
        extractSearchTerms(question)

      const historyTerms =
        history
          .slice(-3)
          .flatMap(
            (previousQuestion) =>
              extractSearchTerms(
                previousQuestion,
              ),
          )

      const terms =
        currentTerms.length >= 2
          ? currentTerms
          : [
              ...new Set([
                ...currentTerms,
                ...historyTerms,
              ]),
            ].slice(0, 10)

      const conditions:
        Prisma.ArticleWhereInput[] = [
          publicArticleFilter(),
        ]

      if (species) {
        conditions.push({
          species,
        })
      }

      if (urgent) {
        conditions.push({
          topic: 'RAPID_RELIEF',
        })
      }

      if (terms.length > 0) {
        conditions.push({
          OR: terms.flatMap(
            (term) => [
              {
                title: {
                  contains: term,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                summary: {
                  contains: term,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                body: {
                  contains: term,
                  mode:
                    'insensitive' as const,
                },
              },
            ],
          ),
        })
      }

      const where:
        Prisma.ArticleWhereInput = {
          AND: conditions,
        }

      const candidateArticles =
        await prisma.article.findMany({
          where,
          orderBy: [
            {
              reviewedAt: 'desc',
            },
            {
              publishedAt: 'desc',
            },
            {
              id: 'asc',
            },
          ],
          take: 20,
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            body: true,
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

      const articles =
        candidateArticles
          .map((article) => ({
            article,
            relevance:
              articleRelevanceScore(
                article,
                terms,
                question,
              ),
          }))
          .sort((a, b) => {
            if (
              b.relevance !==
              a.relevance
            ) {
              return (
                b.relevance -
                a.relevance
              )
            }

            const aReviewed =
              a.article.reviewedAt
                ?.getTime() ?? 0

            const bReviewed =
              b.article.reviewedAt
                ?.getTime() ?? 0

            if (
              bReviewed !==
              aReviewed
            ) {
              return (
                bReviewed -
                aReviewed
              )
            }

            const aPublished =
              a.article.publishedAt
                ?.getTime() ?? 0

            const bPublished =
              b.article.publishedAt
                ?.getTime() ?? 0

            return (
              bPublished -
              aPublished
            )
          })
          .slice(0, 5)
          .map(
            ({ article }) =>
              article,
          )

      const sources =
        articles.map(
          ({
            body: _body,
            ...article
          }) => ({
            ...article,

            href: articleHref(
              article.species,
              article.topic,
              article.slug,
            ),
          }),
        )

      const groundedAnswer =
        buildGroundedAnswer(
          articles,
          terms,
          petContext?.name,
        )

      const context = petContext
        ? {
            pet: petContext,
          }
        : {
            pet: null,
          }

      if (urgent) {
        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          mode:
            'URGENT_HANDOFF',

          message: petContext
            ? `${petContext.name}'s situation may need urgent professional attention. The assistant cannot diagnose the problem or provide medication doses. Contact a veterinarian as soon as possible.`
            : 'This may need urgent professional attention. The assistant cannot diagnose the problem or provide medication doses. Contact a veterinarian as soon as possible.',

          species,

          ...context,

          sources,

          actions: [
            {
              label:
                'Open Rapid Relief',

              href: species
                ? `/rapid-relief?species=${species}`
                : '/rapid-relief',
            },

            {
              label:
                'Find a vet',

              href: '/vets',
            },

            {
              label:
                'Transport contacts',

              href: '/ambulances',
            },
          ],
        })

        return
      }

      if (medicationRequest) {
        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          mode:
            'MEDICATION_HANDOFF',

          message: petContext
            ? `I cannot recommend a medicine, prescribe treatment, or provide a medication dose for ${petContext.name}. A veterinarian should decide what is safe for the individual animal.`
            : 'I cannot recommend a medicine, prescribe treatment, or provide a medication dose. A veterinarian should decide what is safe for the individual animal.',

          species,

          ...context,

          sources,

          actions: [
            {
              label:
                'Find a vet',

              href: '/vets',
            },

            {
              label:
                'Rapid Relief',

              href: species
                ? `/rapid-relief?species=${species}`
                : '/rapid-relief',
            },
          ],
        })

        return
      }

      if (diagnosisRequest) {
        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          mode:
            'DIAGNOSIS_HANDOFF',

          message: petContext
            ? `I can help you find reviewed information relevant to ${petContext.name}, but I cannot diagnose an illness or confirm a medical condition. A veterinarian should assess symptoms.`
            : 'I can help you find reviewed pet-care information, but I cannot diagnose an illness or confirm a medical condition. A veterinarian should assess symptoms.',

          species,

          ...context,

          sources,

          actions: [
            {
              label:
                'Find a vet',

              href: '/vets',
            },

            {
              label:
                'Browse reviewed guidance',

              href:
                generalSpeciesHref(
                  species,
                ),
            },
          ],
        })

        return
      }

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        mode:
          'GUIDED_SEARCH',

        message:
          groundedAnswer ??
          (
            petContext
              ? `I could not find approved information that clearly matches your question about ${petContext.name}. Try another wording, browse the pet guides, or contact a veterinarian if you are concerned.`
              : 'I could not find approved information that clearly matches that question. Try another wording, browse the pet guides, or contact a veterinarian if you are concerned.'
          ),

        species,

        ...context,

        sources,

        actions:
          sources.length === 0
            ? [
                {
                  label:
                    'Browse pet guides',

                  href:
                    generalSpeciesHref(
                      species,
                    ),
                },

                {
                  label:
                    'Find a vet',

                  href: '/vets',
                },
              ]
            : [],
      })
    } catch (error) {
      next(error)
    }
  },
)
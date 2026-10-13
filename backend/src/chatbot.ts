import { Router } from 'express'
import { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import { publicArticleFilter } from './articles.js'
import type {} from './auth.js'

export const chatbotRouter = Router()

type ChatSpecies = 'CAT' | 'DOG' | 'TURTLE'

type ChatTopic =
  | 'BREEDS_AND_SPECIES'
  | 'DAILY_CARE'
  | 'NUTRITION'
  | 'GROOMING'
  | 'HABITAT'
  | 'ENRICHMENT'
  | 'PREVENTIVE_CARE'
  | 'HEALTH'
  | 'RAPID_RELIEF'

type TopicMatch = {
  topic: ChatTopic
  priority: number
}

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
  'again',
  'also',
  'animal',
  'animals',
  'any',
  'are',
  'around',
  'been',
  'being',
  'best',
  'can',
  'could',
  'day',
  'days',
  'does',
  'every',
  'first',
  'from',
  'get',
  'give',
  'good',
  'have',
  'help',
  'how',
  'information',
  'into',
  'just',
  'know',
  'like',
  'long',
  'many',
  'much',
  'need',
  'not',
  'often',
  'old',
  'please',
  'question',
  'really',
  'should',
  'some',
  'thing',
  'things',
  'tell',
  'that',
  'their',
  'there',
  'they',
  'this',
  'time',
  'times',
  'today',
  'want',
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

const speciesPatterns: Record<
  ChatSpecies,
  RegExp[]
> = {
  CAT: [
    /\bcats?\b/i,
    /\bkittens?\b/i,
    /\bkitt(?:y|ies)\b/i,
    /\bfeline\b/i,
  ],
  DOG: [
    /\bdogs?\b/i,
    /\bpupp(?:y|ies)\b/i,
    /\bpups?\b/i,
    /\bcanine\b/i,
  ],
  TURTLE: [
    /\bturtles?\b/i,
    /\btortoises?\b/i,
    /\bterrapins?\b/i,
    /\bchelonian\b/i,
  ],
}

const topicPatterns: Array<{
  topic: ChatTopic
  patterns: RegExp[]
}> = [
  {
    topic: 'RAPID_RELIEF',
    patterns: [
      /\bemergenc(?:y|ies)\b/i,
      /\bfirst aid\b/i,
      /\bbleeding\b/i,
      /\bchoking\b/i,
      /\bpoison(?:ed|ing)?\b/i,
      /\bseizure\b/i,
      /\bcollaps(?:e|ed)\b/i,
    ],
  },
  {
    topic: 'PREVENTIVE_CARE',
    patterns: [
      /\bvaccin(?:e|es|ate|ated|ating|ation|ations)\b/i,
      /\bimmuni[sz](?:e|ed|ation)\b/i,
      /\brabies\b/i,
      /\bdeworm(?:ed|ing)?\b/i,
      /\bparasite prevention\b/i,
      /\bflea(?:s)?\b/i,
      /\bticks?\b/i,
      /\bneuter(?:ed|ing)?\b/i,
      /\bspay(?:ed|ing)?\b/i,
      /\bsterili[sz](?:e|ed|ation)\b/i,
      /\bcheck-?ups?\b/i,
    ],
  },
  {
    topic: 'NUTRITION',
    patterns: [
      /\bfood\b/i,
      /\bfeed(?:ing|s)?\b/i,
      /\bdiets?\b/i,
      /\bnutrition\b/i,
      /\bnutrients?\b/i,
      /\btreats?\b/i,
      /\bportion(?:s)?\b/i,
    ],
  },
  {
    topic: 'GROOMING',
    patterns: [
      /\bgroom(?:ing|ed)?\b/i,
      /\bbrush(?:ing|ed)?\b/i,
      /\bbath(?:ing|s)?\b/i,
      /\bcoat\b/i,
      /\bfurs?\b/i,
      /\bnail(?:s)?\b/i,
    ],
  },
  {
    topic: 'HABITAT',
    patterns: [
      /\bhabitat\b/i,
      /\benclosure\b/i,
      /\btanks?\b/i,
      /\bbasking\b/i,
      /\buvb\b/i,
      /\bsubstrate\b/i,
      /\btemperature\b/i,
    ],
  },
  {
    topic: 'ENRICHMENT',
    patterns: [
      /\benrichment\b/i,
      /\bplay(?:ing)?\b/i,
      /\btoys?\b/i,
      /\bexercise\b/i,
      /\bbored(?:om)?\b/i,
      /\btraining\b/i,
    ],
  },
  {
    topic: 'HEALTH',
    patterns: [
      /\bhealth\b/i,
      /\bsick(?:ness)?\b/i,
      /\bsymptoms?\b/i,
      /\billness\b/i,
      /\bdisease\b/i,
      /\binfection\b/i,
      /\bvomit(?:ing|ed)?\b/i,
      /\bdiarrh(?:ea|oea)\b/i,
      /\bnot eating\b/i,
      /\bnot drinking\b/i,
      /\binjur(?:y|ies|ed)\b/i,
      /\bpain(?:ful)?\b/i,
      /\bwounds?\b/i,
      /\blumps?\b/i,
    ],
  },
  {
    topic: 'BREEDS_AND_SPECIES',
    patterns: [
      /\bbreeds?\b/i,
      /\bspecies\b/i,
      /\btemperament\b/i,
      /\blifespan\b/i,
      /\blife expectancy\b/i,
      /\bhow long .*\blive\b/i,
      /\babout (?:cats?|dogs?|turtles?|tortoises?)\b/i,
    ],
  },
  {
    topic: 'DAILY_CARE',
    patterns: [
      /\bdaily care\b/i,
      /\b(?:basic|general|everyday|routine|cat|dog|turtle|pet) care\b/i,
      /\bday-to-day\b/i,
      /\broutine\b/i,
      /\blitter(?: box)?\b/i,
      /\bwalk(?:ing|s)?\b/i,
      /\bsleep(?:ing)?\b/i,
      /\bhygiene\b/i,
    ],
  },
]

const keywordAliases: Record<string, string[]> = {
  vaccinate: ['vaccine', 'vaccination', 'immunization'],
  vaccinated: ['vaccine', 'vaccination', 'immunization'],
  vaccinating: ['vaccine', 'vaccination', 'immunization'],
  vaccination: ['vaccine', 'vaccination', 'immunization'],
  vaccinations: ['vaccine', 'vaccination', 'immunization'],
  vaccines: ['vaccine', 'vaccination', 'immunization'],
  neuter: ['neuter', 'neutering', 'sterilization'],
  neutered: ['neuter', 'neutering', 'sterilization'],
  neutering: ['neuter', 'neutering', 'sterilization'],
  spay: ['spay', 'spaying', 'sterilization'],
  spayed: ['spay', 'spaying', 'sterilization'],
  spaying: ['spay', 'spaying', 'sterilization'],
  food: ['food', 'feeding', 'diet', 'nutrition'],
  feed: ['food', 'feeding', 'diet', 'nutrition'],
  feeding: ['food', 'feeding', 'diet', 'nutrition'],
  diet: ['food', 'feeding', 'diet', 'nutrition'],
  groom: ['groom', 'grooming', 'brush'],
  grooming: ['groom', 'grooming', 'brush'],
}

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

const veterinaryDecisionPatterns = [
  /\bvaccin(?:e|es|ate|ated|ating|ation|ations)\b/i,
  /\bimmuni[sz](?:e|ed|ation)\b/i,
  /\bneuter(?:ed|ing)?\b/i,
  /\bspay(?:ed|ing)?\b/i,
  /\bsterili[sz](?:e|ed|ation)\b/i,
  /\bsurger(?:y|ies)\b/i,
  /\boperation\b/i,
  /\ban[ae]sthesi(?:a|c)\b/i,
  /\beuthanasi[ae]\b/i,
  /\bsick(?:ness)?\b/i,
  /\bsymptoms?\b/i,
  /\bvomit(?:ing|ed)?\b/i,
  /\bdiarrh(?:ea|oea)\b/i,
  /\bnot eating\b/i,
  /\bnot drinking\b/i,
  /\binjur(?:y|ies|ed)\b/i,
  /\bpain(?:ful)?\b/i,
  /\bwounds?\b/i,
  /\binfection\b/i,
]

function containsPattern(
  value: string,
  patterns: RegExp[],
) {
  return patterns.some((pattern) =>
    pattern.test(value),
  )
}

function detectSpecies(
  value: string,
): ChatSpecies | null {
  const matches = (
    Object.entries(speciesPatterns) as Array<
      [ChatSpecies, RegExp[]]
    >
  )
    .filter(([, patterns]) =>
      containsPattern(value, patterns),
    )
    .map(([species]) => species)

  return matches.length === 1
    ? matches[0]
    : null
}

function detectTopics(
  value: string,
): TopicMatch[] {
  return topicPatterns
    .map(({ topic, patterns }) => ({
      topic,
      priority: patterns.reduce(
        (score, pattern) =>
          score + (pattern.test(value) ? 1 : 0),
        0,
      ),
    }))
    .filter(({ priority }) => priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
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

  const expanded = words.flatMap(
    (word) => keywordAliases[word] ?? [word],
  )

  return [...new Set(expanded)].slice(0, 14)
}

function isFollowUpQuestion(
  question: string,
) {
  return /\b(?:it|its|that|this|they|them|those|same|more)\b/i.test(
    question,
  )
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
    topic: string
  },
  terms: string[],
  question: string,
  topics: TopicMatch[],
) {
  let score = 0
  let matchedTerms = 0

  const title =
    article.title.toLowerCase()

  const summary =
    article.summary.toLowerCase()

  const body =
    article.body.toLowerCase()

  for (const term of terms) {
    const titleMatches =
      countOccurrences(title, term)

    const summaryMatches =
      countOccurrences(summary, term)

    const bodyMatches = Math.min(
      countOccurrences(body, term),
      5,
    )

    if (
      titleMatches > 0 ||
      summaryMatches > 0 ||
      bodyMatches > 0
    ) {
      matchedTerms += 1
    }

    score += titleMatches * 10
    score += summaryMatches * 6
    score += bodyMatches * 2
  }

  const topicIndex = topics.findIndex(
    ({ topic }) => topic === article.topic,
  )

  if (topicIndex === 0) {
    score += 14
  } else if (topicIndex === 1) {
    score += 8
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

  return {
    score,
    matchedTerms,
    topicMatched: topicIndex !== -1,
  }
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
    return null
  }

  return petName
    ? `For ${petName}, the published guidance says: ${shortenText(
        best.paragraph,
      )}`
    : `Based on the published guidance: ${shortenText(
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

function eligibleChatbotArticleFilter():
  Prisma.ArticleWhereInput {
  return {
    AND: [
      publicArticleFilter(),
      {
        sourceUrls: {
          isEmpty: false,
        },
      },
    ],
  }
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
              eligibleChatbotArticleFilter(),
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

      const veterinaryDecision =
        containsPattern(
          question,
          veterinaryDecisionPatterns,
        )

      const currentTerms =
        extractSearchTerms(question)

      const useHistory =
        currentTerms.length === 0 &&
        isFollowUpQuestion(question)

      const recentHistory =
        useHistory
          ? history.slice(-2)
          : []

      const historyTerms =
        recentHistory.flatMap(
          (previousQuestion) =>
            extractSearchTerms(
              previousQuestion,
            ),
        )

      const terms =
        currentTerms.length > 0
          ? currentTerms
          : [
              ...new Set(historyTerms),
            ].slice(0, 14)

      const currentTopics =
        detectTopics(question)

      const historyTopics =
        recentHistory.flatMap(
          (previousQuestion) =>
            detectTopics(
              previousQuestion,
            ),
        )

      const topics = urgent
        ? [
            {
              topic:
                'RAPID_RELIEF' as const,
              priority: 100,
            },
          ]
        : currentTopics.length > 0
          ? currentTopics
          : historyTopics.slice(0, 2)

      const questionSpecies =
        detectSpecies(question)

      const historySpecies =
        recentHistory
          .map(detectSpecies)
          .find(
            (value) => value !== null,
          ) ?? null

      const species =
        questionSpecies ??
        historySpecies ??
        petContext?.species ??
        requestedSpecies

      const effectivePetContext =
        petContext &&
        species === petContext.species
          ? petContext
          : null

      const conditions:
        Prisma.ArticleWhereInput[] = [
          eligibleChatbotArticleFilter(),
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

      const retrievalAlternatives:
        Prisma.ArticleWhereInput[] = [
          ...terms.flatMap(
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
          ...topics.map(({ topic }) => ({
            topic,
          })),
        ]

      if (
        !urgent &&
        retrievalAlternatives.length > 0
      ) {
        conditions.push({
          OR: retrievalAlternatives,
        })
      }

      const where:
        Prisma.ArticleWhereInput = {
          AND: conditions,
        }

      const candidateArticles =
        retrievalAlternatives.length > 0
          ? await prisma.article.findMany({
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
              take: 30,
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
          : []

      const minimumRelevanceScore = 12

      const articles =
        candidateArticles
          .map((article) => ({
            article,
            relevance:
              articleRelevanceScore(
                article,
                terms,
                question,
                topics,
              ),
          }))
          .filter(({ relevance }) =>
            relevance.score >=
              minimumRelevanceScore &&
            (
              terms.length > 0
                ? (
                    relevance.matchedTerms > 0 &&
                    (
                      topics.length === 0 ||
                      relevance.topicMatched
                    )
                  )
                : relevance.topicMatched
            ),
          )
          .sort((a, b) => {
            if (
              b.relevance.score !==
              a.relevance.score
            ) {
              return (
                b.relevance.score -
                a.relevance.score
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
          .slice(0, 3)
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
          effectivePetContext?.name,
        )

      const context = effectivePetContext
        ? {
            pet: effectivePetContext,
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

          message: effectivePetContext
            ? `${effectivePetContext.name}'s situation may need urgent professional attention. The assistant cannot diagnose the problem or provide medication doses. Contact a licensed veterinarian or emergency veterinary service as soon as possible.`
            : 'This may need urgent professional attention. The assistant cannot diagnose the problem or provide medication doses. Contact a licensed veterinarian or emergency veterinary service as soon as possible.',

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

          message: effectivePetContext
            ? `I cannot recommend a medicine, prescribe treatment, or provide a medication dose for ${effectivePetContext.name}. A licensed veterinarian should decide what is safe for the individual animal.`
            : 'I cannot recommend a medicine, prescribe treatment, or provide a medication dose. A licensed veterinarian should decide what is safe for the individual animal.',

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

          message: effectivePetContext
            ? `I can help you find eligible published information relevant to ${effectivePetContext.name}, but I cannot diagnose an illness or confirm a medical condition. A licensed veterinarian should assess symptoms.`
            : 'I can help you find eligible published pet-care information, but I cannot diagnose an illness or confirm a medical condition. A licensed veterinarian should assess symptoms.',

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
                'Browse published guidance',

              href:
                generalSpeciesHref(
                  species,
                ),
            },
          ],
        })

        return
      }

      if (veterinaryDecision) {
        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        const veterinaryMessage =
          groundedAnswer
            ? `${groundedAnswer} This is general educational information, not an individual veterinary recommendation. Consult a licensed veterinarian before making vaccination, neutering, surgical, or other medical-care decisions.`
            : sources.length > 0
              ? 'I found relevant reviewed sources below, but not a passage that reliably answers your specific veterinary question. Consult a licensed veterinarian before making vaccination, neutering, surgical, or other medical-care decisions.'
              : 'I could not find a currently published, reviewed, non-expired source that clearly answers this veterinary question. Consult a licensed veterinarian before making vaccination, neutering, surgical, or other medical-care decisions.'

        res.json({
          mode:
            'VETERINARY_GUIDANCE',

          message:
            veterinaryMessage,

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
          sources.length === 0
            ? 'NO_RELIABLE_SOURCE'
            : 'GUIDED_SEARCH',

        message:
          groundedAnswer ??
          (
            sources.length > 0
              ? 'I found relevant published sources below, but not a passage that reliably answers the specific question. Please read the sources or consult a licensed veterinarian if you are concerned.'
              : effectivePetContext
                ? `I could not find a currently eligible, published, source-supported article that clearly matches your question about ${effectivePetContext.name}. Reliable information is unavailable in the current library; try another wording or consult a licensed veterinarian if you are concerned.`
                : 'I could not find a currently eligible, published, source-supported article that clearly matches that question. Reliable information is unavailable in the current library; try another wording or consult a licensed veterinarian if you are concerned.'
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

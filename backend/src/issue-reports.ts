import { createHash } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from './db.js'
import {
  IssueReportCategory,
  Prisma,
} from './generated/prisma/client.js'
import type {} from './auth.js'

export const issueReportsRouter = Router()

type ReportTargetType =
  | 'ARTICLE'
  | 'VET'
  | 'AMBULANCE'
  | 'CHATBOT'

class IssueReportError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'IssueReportError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message:
      'Too many report attempts. Please try again later.',
  },
})

function isTargetType(
  value: unknown,
): value is ReportTargetType {
  return (
    value === 'ARTICLE' ||
    value === 'VET' ||
    value === 'AMBULANCE' ||
    value === 'CHATBOT'
  )
}

issueReportsRouter.use(
  async (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    const userId =
      req.session.userId

    if (!userId) {
      res.status(401).json({
        message: 'Please sign in.',
      })
      return
    }

    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
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

      next()
    } catch (error) {
      next(error)
    }
  },
)

// POST /api/issue-reports
issueReportsRouter.post(
  '/',
  reportLimiter,
  async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ??
      'http://localhost:5173'

    const origin =
      req.get('origin')

    if (
      (
        origin &&
        origin !== allowedOrigin
      ) ||
      req.get('sec-fetch-site') ===
        'cross-site'
    ) {
      res.status(403).json({
        message:
          'Request origin is not allowed.',
      })
      return
    }

    if (
      !req.is('application/json')
    ) {
      res.status(415).json({
        message:
          'Send the request as JSON.',
      })
      return
    }

    const reporterId =
      req.session.userId

    if (!reporterId) {
      res.status(401).json({
        message: 'Please sign in.',
      })
      return
    }

    const input = req.body

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      res.status(400).json({
        message:
          'Invalid report request.',
      })
      return
    }

    const allowedKeys = new Set([
      'targetType',
      'targetId',
      'category',
      'details',
      'idempotencyKey',
      'chatbotQuestion',
      'chatbotResponse',
      'chatbotMode',
    ])

    if (
      Object.keys(input).some(
        (key) =>
          !allowedKeys.has(key),
      )
    ) {
      res.status(400).json({
        message:
          'The report contains unsupported fields.',
      })
      return
    }

    if (
      !isTargetType(
        input.targetType,
      )
    ) {
      res.status(400).json({
        message:
          'Invalid report target type.',
      })
      return
    }

    if (
      typeof input.targetId !==
        'string' ||
      !uuidPattern.test(
        input.targetId,
      )
    ) {
      res.status(400).json({
        message:
          'Invalid report target.',
      })
      return
    }

    if (
      typeof input.idempotencyKey !==
        'string' ||
      !uuidPattern.test(
        input.idempotencyKey,
      )
    ) {
      res.status(400).json({
        message:
          'Invalid submission key.',
      })
      return
    }

    if (
      typeof input.category !==
        'string' ||
      !Object.values(
        IssueReportCategory,
      ).includes(
        input.category as
          IssueReportCategory,
      )
    ) {
      res.status(400).json({
        message:
          'Choose a valid report category.',
      })
      return
    }

    if (
      typeof input.details !==
        'string' ||
      input.details.trim().length <
        10 ||
      input.details.length > 2000
    ) {
      res.status(400).json({
        message:
          'Describe the issue using 10–2000 characters.',
      })
      return
    }

    const targetType =
      input.targetType

    const targetId =
      input.targetId.toLowerCase()

    const idempotencyKey =
      input.idempotencyKey.toLowerCase()

    const category =
      input.category as
        IssueReportCategory

    const details =
      input.details.trim()

    let chatbotQuestion:
      string | null = null

    let chatbotResponse:
      string | null = null

    let chatbotMode:
      string | null = null

    if (
      targetType === 'CHATBOT'
    ) {
      if (
        typeof input.chatbotQuestion !==
          'string' ||
        input.chatbotQuestion
          .trim().length < 3 ||
        input.chatbotQuestion.length >
          500
      ) {
        res.status(400).json({
          message:
            'The chatbot question is invalid.',
        })
        return
      }

      if (
        typeof input.chatbotResponse !==
          'string' ||
        input.chatbotResponse
          .trim().length < 1 ||
        input.chatbotResponse.length >
          2000
      ) {
        res.status(400).json({
          message:
            'The chatbot response is invalid.',
        })
        return
      }

      if (
        typeof input.chatbotMode !==
          'string' ||
        input.chatbotMode
          .trim().length < 1 ||
        input.chatbotMode.length >
          50
      ) {
        res.status(400).json({
          message:
            'The chatbot response mode is invalid.',
        })
        return
      }

      chatbotQuestion =
        input.chatbotQuestion.trim()

      chatbotResponse =
        input.chatbotResponse.trim()

      chatbotMode =
        input.chatbotMode.trim()
    } else {
      if (
        input.chatbotQuestion !==
          undefined ||
        input.chatbotResponse !==
          undefined ||
        input.chatbotMode !==
          undefined
      ) {
        res.status(400).json({
          message:
            'Chatbot fields are only allowed for chatbot reports.',
        })
        return
      }
    }

    const requestFingerprint =
      createHash('sha256')
        .update(
          JSON.stringify({
            targetType,
            targetId,
            category,
            details,
            chatbotQuestion,
            chatbotResponse,
            chatbotMode,
          }),
        )
        .digest('hex')

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const reporter =
              await tx.user.findUnique({
                where: {
                  id: reporterId,
                },
                select: {
                  status: true,
                },
              })

            if (
              !reporter ||
              reporter.status !==
                'ACTIVE'
            ) {
              throw new IssueReportError(
                401,
                'Please sign in with an active account.',
              )
            }

            const existing =
              await tx.issueReport
                .findUnique({
                  where: {
                    reporterId_idempotencyKey:
                      {
                        reporterId,
                        idempotencyKey,
                      },
                  },
                  select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    requestFingerprint:
                      true,
                  },
                })

            if (existing) {
              if (
                existing
                  .requestFingerprint !==
                requestFingerprint
              ) {
                throw new IssueReportError(
                  409,
                  'This submission key was already used with different report details.',
                )
              }

              return {
                replayed: true,
                report: {
                  id:
                    existing.id,

                  status:
                    existing.status,

                  createdAt:
                    existing.createdAt,
                },
              }
            }

            const now =
              new Date()

            let targetLabel =
              ''

            if (
              targetType ===
              'ARTICLE'
            ) {
              const article =
                await tx.article
                  .findFirst({
                    where: {
                      id: targetId,

                      status:
                        'PUBLISHED',

                      publishedAt: {
                        lte: now,
                      },

                      AND: [
                        {
                          OR: [
                            {
                              reviewDueAt:
                                null,
                            },
                            {
                              reviewDueAt:
                                {
                                  gt: now,
                                },
                            },
                          ],
                        },

                        {
                          OR: [
                            {
                              requiresClinicalReview:
                                false,

                              topic: {
                                notIn: [
                                  'HEALTH',
                                  'PREVENTIVE_CARE',
                                  'RAPID_RELIEF',
                                ],
                              },
                            },

                            {
                              reviewerName:
                                {
                                  not: null,
                                },

                              reviewerCredentials:
                                {
                                  not: null,
                                },

                              reviewedAt:
                                {
                                  lte: now,
                                },

                              reviewDueAt:
                                {
                                  gt: now,
                                },

                              sourceUrls:
                                {
                                  isEmpty:
                                    false,
                                },
                            },
                          ],
                        },
                      ],
                    },

                    select: {
                      title: true,
                    },
                  })

              if (!article) {
                throw new IssueReportError(
                  404,
                  'The article is no longer available for reporting.',
                )
              }

              targetLabel =
                article.title
            } else if (
              targetType === 'VET'
            ) {
              const vet =
                await tx.vetListing
                  .findFirst({
                    where: {
                      id: targetId,

                      status:
                        'PUBLISHED',

                      verificationStatus:
                        'APPROVED',

                      publishedAt: {
                        lte: now,
                      },

                      verificationReviewedAt:
                        {
                          lte: now,
                        },

                      verificationReviewedById:
                        {
                          not: null,
                        },

                      isDemo: false,
                    },

                    select: {
                      vetName: true,

                      clinicName:
                        true,

                      user: {
                        select: {
                          role: true,
                          status: true,
                        },
                      },
                    },
                  })

              if (
                !vet ||
                (
                  vet.user !== null &&
                  (
                    vet.user.role !==
                      'VET' ||
                    vet.user.status !==
                      'ACTIVE'
                  )
                )
              ) {
                throw new IssueReportError(
                  404,
                  'The vet listing is not available for reporting.',
                )
              }

              targetLabel =
                `${vet.vetName} — ${vet.clinicName}`
                  .slice(0, 250)
            } else if (
              targetType ===
              'AMBULANCE'
            ) {
              const ambulance =
                await tx
                  .ambulanceListing
                  .findFirst({
                    where: {
                      id: targetId,

                      isDemo: false,

                      status:
                        'PUBLISHED',

                      publishedAt: {
                        lte: now,
                      },

                      verificationStatus:
                        'APPROVED',

                      verificationReviewedAt:
                        {
                          lte: now,
                        },

                      verificationReviewedById:
                        {
                          not: null,
                        },

                      user: {
                        is: {
                          role:
                            'AMBULANCE_PROVIDER',

                          status:
                            'ACTIVE',
                        },
                      },
                    },

                    select: {
                      providerName:
                        true,
                    },
                  })

              if (!ambulance) {
                throw new IssueReportError(
                  404,
                  'The ambulance listing is not available for reporting.',
                )
              }

              targetLabel =
                ambulance.providerName
            } else {
              targetLabel =
                `Chatbot response — ${chatbotMode ?? 'Unknown mode'}`
                  .slice(0, 250)
            }

            const report =
              await tx.issueReport
                .create({
                  data: {
                    reporterId,

                    articleId:
                      targetType ===
                      'ARTICLE'
                        ? targetId
                        : null,

                    vetListingId:
                      targetType ===
                      'VET'
                        ? targetId
                        : null,

                    ambulanceListingId:
                      targetType ===
                      'AMBULANCE'
                        ? targetId
                        : null,

                    chatbotResponseId:
                      targetType ===
                      'CHATBOT'
                        ? targetId
                        : null,

                    targetLabel,

                    chatbotQuestion:
                      targetType ===
                      'CHATBOT'
                        ? chatbotQuestion
                        : null,

                    chatbotResponse:
                      targetType ===
                      'CHATBOT'
                        ? chatbotResponse
                        : null,

                    chatbotMode:
                      targetType ===
                      'CHATBOT'
                        ? chatbotMode
                        : null,

                    category,

                    details,

                    idempotencyKey,

                    requestFingerprint,

                    status: 'OPEN',

                    version: 1,

                    events: {
                      create: {
                        actorId:
                          reporterId,

                        version: 1,

                        action:
                          'ISSUE_REPORT_CREATED',

                        newStatus:
                          'OPEN',
                      },
                    },
                  },

                  select: {
                    id: true,
                    status: true,
                    createdAt: true,
                  },
                })

            return {
              replayed: false,
              report,
            }
          },

          {
            isolationLevel:
              Prisma
                .TransactionIsolationLevel
                .Serializable,
          },
        )

      res.status(
        result.replayed
          ? 200
          : 201,
      ).json({
        message:
          result.replayed
            ? 'Existing report returned. No duplicate was created.'
            : 'Report received for administrator review.',

        ...result,
      })
    } catch (error) {
      console.error(
        'Issue report submission failed:',
        error,
      )

      if (
        error instanceof
        IssueReportError
      ) {
        res.status(
          error.statusCode,
        ).json({
          message:
            error.message,
        })
        return
      }

      if (
        error instanceof
          Prisma
            .PrismaClientKnownRequestError
      ) {
        if (
          error.code === 'P2002' ||
          error.code === 'P2034'
        ) {
          res.status(409).json({
            message:
              'A concurrent change occurred. Retry with the same submission key and details.',

            retryable: true,
          })
          return
        }

        if (
          error.code === 'P2039'
        ) {
          res.status(500).json({
            message:
              'The report database structure is not accepting this target. Check the issue_reports target constraint.',
          })
          return
        }
      }

      next(error)
    }
  },
)

// GET /api/issue-reports?page=1
issueReportsRouter.get(
  '/',
  async (req, res, next) => {
    const reporterId =
      req.session.userId

    if (!reporterId) {
      res.status(401).json({
        message:
          'Please sign in.',
      })
      return
    }

    const page =
      req.query.page

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

    const pageNumber =
      page === undefined
        ? 1
        : Number(page)

    const pageSize = 12

    try {
      const [
        reports,
        total,
      ] =
        await prisma.$transaction(
          [
            prisma.issueReport
              .findMany({
                where: {
                  reporterId,
                },

                orderBy: [
                  {
                    createdAt:
                      'desc',
                  },
                  {
                    id: 'desc',
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

                select: {
                  id: true,

                  targetLabel:
                    true,

                  category: true,

                  details: true,

                  status: true,

                  resolutionSummary:
                    true,

                  createdAt: true,

                  closedAt: true,
                },
              }),

            prisma.issueReport.count(
              {
                where: {
                  reporterId,
                },
              },
            ),
          ],

          {
            isolationLevel:
              Prisma
                .TransactionIsolationLevel
                .RepeatableRead,
          },
        )

      res.json({
        reports,
        total,
        page: pageNumber,

        totalPages:
          Math.ceil(
            total /
              pageSize,
          ),
      })
    } catch (error) {
      next(error)
    }
  },
)
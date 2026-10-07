import { Router } from 'express'
import { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'
import type {} from './auth.js'

export const adminIssueReportsRouter = Router()

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class ReportReviewError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ReportReviewError'
  }
}

// Every endpoint requires an active administrator.
adminIssueReportsRouter.use(
  async (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    try {
      const userId =
        req.session.userId

      if (!userId) {
        res.status(401).json({
          message: 'Please sign in.',
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
            'Please sign in again.',
        })
        return
      }

      if (
        user.role !== 'ADMIN'
      ) {
        res.status(403).json({
          message:
            'Administrator access is required.',
        })
        return
      }

      next()
    } catch (error) {
      next(error)
    }
  },
)

// GET /api/admin/issue-reports?status=OPEN&page=1
// Omit status to include reports in every status.
adminIssueReportsRouter.get(
  '/',
  async (req, res, next) => {
    const {
      status,
      page,
    } = req.query

    if (
      status !== undefined &&
      status !== 'OPEN' &&
      status !==
        'UNDER_REVIEW' &&
      status !== 'RESOLVED' &&
      status !== 'DISMISSED'
    ) {
      res.status(400).json({
        message:
          'Status must be OPEN, UNDER_REVIEW, RESOLVED, or DISMISSED.',
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

    const pageNumber =
      page === undefined
        ? 1
        : Number(page)

    const pageSize = 12

    const where:
      Prisma.IssueReportWhereInput =
      status === undefined
        ? {}
        : {
            status,
          }

    try {
      const [
        reports,
        total,
      ] =
        await prisma.$transaction(
          [
            prisma.issueReport
              .findMany({
                where,

                orderBy: [
                  {
                    createdAt:
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

                take: pageSize,

                select: {
                  id: true,

                  targetLabel:
                    true,

                  articleId:
                    true,

                  vetListingId:
                    true,

                  ambulanceListingId:
                    true,

                  chatbotResponseId:
                    true,

                  chatbotQuestion:
                    true,

                  chatbotResponse:
                    true,

                  chatbotMode:
                    true,

                  category: true,

                  details: true,

                  status: true,

                  resolutionSummary:
                    true,

                  version: true,

                  createdAt: true,

                  updatedAt: true,

                  closedAt: true,
                },
              }),

            prisma.issueReport.count(
              {
                where,
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

        page:
          pageNumber,

        pageSize,

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

// PATCH /api/admin/issue-reports/:id/status
adminIssueReportsRouter.patch(
  '/:id/status',
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
      !req.is(
        'application/json',
      )
    ) {
      res.status(415).json({
        message:
          'Send the request as JSON.',
      })
      return
    }

    const id =
      req.params.id

    if (
      typeof id !== 'string' ||
      !uuidPattern.test(id)
    ) {
      res.status(400).json({
        message:
          'Invalid report ID.',
      })
      return
    }

    const body =
      req.body

    if (
      !body ||
      typeof body !==
        'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) =>
          ![
            'status',
            'version',
            'resolutionSummary',
          ].includes(key),
      )
    ) {
      res.status(400).json({
        message:
          'Invalid review request.',
      })
      return
    }

    const {
      status,
      version,
    } = body

    if (
      status !==
        'UNDER_REVIEW' &&
      status !== 'RESOLVED' &&
      status !== 'DISMISSED'
    ) {
      res.status(400).json({
        message:
          'Choose UNDER_REVIEW, RESOLVED, or DISMISSED.',
      })
      return
    }

    if (
      typeof version !==
        'number' ||
      !Number.isSafeInteger(
        version,
      ) ||
      version < 1 ||
      version >= 2147483647
    ) {
      res.status(400).json({
        message:
          'A valid report version is required.',
      })
      return
    }

    if (
      body.resolutionSummary !==
        undefined &&
      typeof body
        .resolutionSummary !==
        'string'
    ) {
      res.status(400).json({
        message:
          'The outcome explanation must be text.',
      })
      return
    }

    const summary =
      typeof body
        .resolutionSummary ===
      'string'
        ? body
            .resolutionSummary
            .trim()
        : ''

    const closing =
      status === 'RESOLVED' ||
      status === 'DISMISSED'

    if (
      (
        typeof body
          .resolutionSummary ===
          'string' &&
        body.resolutionSummary
          .length > 1000
      ) ||
      (
        closing &&
        summary.length < 10
      )
    ) {
      res.status(400).json({
        message:
          'To resolve or dismiss a report, enter an explanation between 10 and 1000 characters.',
      })
      return
    }

    if (
      !closing &&
      summary.length > 0
    ) {
      res.status(400).json({
        message:
          'Add the outcome explanation when resolving or dismissing the report.',
      })
      return
    }

    const actorId =
      req.session.userId

    if (!actorId) {
      res.status(401).json({
        message:
          'Please sign in.',
      })
      return
    }

    try {
      const report =
        await prisma.$transaction(
          async (tx) => {
            // Recheck permissions inside
            // the write transaction.
            const actor =
              await tx.user
                .findUnique({
                  where: {
                    id: actorId,
                  },
                  select: {
                    role: true,
                    status: true,
                  },
                })

            if (
              !actor ||
              actor.status !==
                'ACTIVE'
            ) {
              throw new ReportReviewError(
                401,
                'Please sign in again.',
              )
            }

            if (
              actor.role !==
              'ADMIN'
            ) {
              throw new ReportReviewError(
                403,
                'Administrator access is required.',
              )
            }

            const current =
              await tx.issueReport
                .findUnique({
                  where: {
                    id,
                  },
                  select: {
                    status: true,
                    version: true,
                  },
                })

            if (!current) {
              throw new ReportReviewError(
                404,
                'Report not found.',
              )
            }

            if (
              current.version !==
              version
            ) {
              throw new ReportReviewError(
                409,
                'This report has changed. Refresh the queue before trying again.',
              )
            }

            const allowedTransition =
              (
                current.status ===
                  'OPEN' &&
                status ===
                  'UNDER_REVIEW'
              ) ||
              (
                current.status ===
                  'UNDER_REVIEW' &&
                closing
              )

            if (
              !allowedTransition
            ) {
              throw new ReportReviewError(
                409,
                'Start review before closing a report. Closed reports cannot be changed.',
              )
            }

            const now =
              new Date()

            const updated =
              await tx.issueReport
                .updateMany({
                  where: {
                    id,
                    version,
                    status:
                      current.status,
                  },

                  data: {
                    status,

                    version: {
                      increment: 1,
                    },

                    resolutionSummary:
                      closing
                        ? summary
                        : null,

                    closedAt:
                      closing
                        ? now
                        : null,
                  },
                })

            if (
              updated.count !== 1
            ) {
              throw new ReportReviewError(
                409,
                'This report has changed. Refresh the queue before trying again.',
              )
            }

            await tx
              .issueReportEvent
              .create({
                data: {
                  reportId: id,

                  actorId,

                  version:
                    version + 1,

                  action:
                    status ===
                    'UNDER_REVIEW'
                      ? 'ISSUE_REPORT_REVIEW_STARTED'
                      : status ===
                          'RESOLVED'
                        ? 'ISSUE_REPORT_RESOLVED'
                        : 'ISSUE_REPORT_DISMISSED',

                  previousStatus:
                    current.status,

                  newStatus:
                    status,
                },
              })

            return tx
              .issueReport
              .findUniqueOrThrow({
                where: {
                  id,
                },

                select: {
                  id: true,

                  status: true,

                  version: true,

                  resolutionSummary:
                    true,

                  closedAt: true,
                },
              })
          },

          {
            isolationLevel:
              Prisma
                .TransactionIsolationLevel
                .Serializable,
          },
        )

      res.json({
        message:
          'Report updated successfully.',

        report,
      })
    } catch (error) {
      if (
        error instanceof
        ReportReviewError
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
            .PrismaClientKnownRequestError &&
        (
          error.code ===
            'P2034' ||
          error.code ===
            'P2002'
        )
      ) {
        res.status(409).json({
          message:
            'Another update occurred. Refresh the queue before trying again.',
        })
        return
      }

      next(error)
    }
  },
)

// GET /api/admin/issue-reports/:id/history
adminIssueReportsRouter.get(
  '/:id/history',
  async (req, res, next) => {
    const id =
      req.params.id

    if (
      typeof id !== 'string' ||
      !uuidPattern.test(id)
    ) {
      res.status(400).json({
        message:
          'Invalid report ID.',
      })
      return
    }

    try {
      const report =
        await prisma.issueReport
          .findUnique({
            where: {
              id,
            },

            select: {
              id: true,

              targetLabel: true,

              articleId: true,

              vetListingId: true,

              ambulanceListingId:
                true,

              chatbotResponseId:
                true,

              chatbotQuestion:
                true,

              chatbotResponse:
                true,

              chatbotMode:
                true,

              category: true,

              details: true,

              status: true,

              resolutionSummary:
                true,

              createdAt: true,

              updatedAt: true,

              closedAt: true,

              events: {
                orderBy: {
                  version: 'asc',
                },

                select: {
                  id: true,

                  version: true,

                  action: true,

                  previousStatus:
                    true,

                  newStatus: true,

                  createdAt: true,

                  actor: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          })

      if (!report) {
        res.status(404).json({
          message:
            'Report not found.',
        })
        return
      }

      res.json({
        report: {
          ...report,

          events:
            report.events.map(
              (event) => ({
                ...event,

                // Submission history
                // does not expose the
                // reporter's identity.
                actor:
                  event.action ===
                  'ISSUE_REPORT_CREATED'
                    ? null
                    : event.actor,
              }),
            ),
        },
      })
    } catch (error) {
      next(error)
    }
  },
)
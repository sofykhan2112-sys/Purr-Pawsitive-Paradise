import { Router } from 'express'
import {
  AccountStatus,
  Prisma,
} from './generated/prisma/client.js'
import { prisma } from './db.js'
import type {} from './auth.js'

export const adminUsersRouter =
  Router()

class AdminUserError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AdminUserError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

adminUsersRouter.use(
  async (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    const userId =
      req.session.userId

    if (!userId) {
      res.status(401).json({
        message:
          'Please sign in.',
      })
      return
    }

    try {
      const admin =
        await prisma.user
          .findUnique({
            where: {
              id: userId,
            },

            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          })

      if (
        !admin ||
        admin.status !==
          'ACTIVE'
      ) {
        res.status(401).json({
          message:
            'Please sign in with an active account.',
        })
        return
      }

      if (
        admin.role !== 'ADMIN'
      ) {
        res.status(403).json({
          message:
            'Administrator access is required.',
        })
        return
      }

      res.locals.admin =
        admin

      next()
    } catch (error) {
      next(error)
    }
  },
)

// GET /api/admin/users?page=1&q=&status=&role=
adminUsersRouter.get(
  '/',
  async (req, res, next) => {
    const page =
      req.query.page

    const q =
      req.query.q

    const status =
      req.query.status

    const role =
      req.query.role

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
          'Page must be a positive number.',
      })
      return
    }

    if (
      q !== undefined &&
      typeof q !== 'string'
    ) {
      res.status(400).json({
        message:
          'Search must be text.',
      })
      return
    }

    const allowedStatuses =
      new Set([
        'ACTIVE',
        'SUSPENDED',
      ])

    if (
      status !== undefined &&
      (
        typeof status !==
          'string' ||
        !allowedStatuses.has(
          status,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Invalid account status.',
      })
      return
    }

    const allowedRoles =
      new Set([
        'OWNER',
        'VET',
        'AMBULANCE_PROVIDER',
        'ADMIN',
      ])

    if (
      role !== undefined &&
      (
        typeof role !==
          'string' ||
        !allowedRoles.has(
          role,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Invalid account role.',
      })
      return
    }

    const pageNumber =
      page === undefined
        ? 1
        : Number(page)

    const pageSize = 20

    const search =
      typeof q === 'string'
        ? q.trim()
        : ''

    if (
      search.length > 100
    ) {
      res.status(400).json({
        message:
          'Search is too long.',
      })
      return
    }

    const where:
      Prisma.UserWhereInput = {}

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ]
    }

    if (
      status === 'ACTIVE' ||
      status === 'SUSPENDED'
    ) {
      where.status =
        status
    }

    if (
      role === 'OWNER' ||
      role === 'VET' ||
      role ===
        'AMBULANCE_PROVIDER' ||
      role === 'ADMIN'
    ) {
      where.role =
        role
    }

    try {
      const [
        users,
        total,
      ] =
        await prisma.$transaction(
          [
            prisma.user.findMany(
              {
                where,

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
                  name: true,
                  email: true,
                  role: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            ),

            prisma.user.count({
              where,
            }),
          ],

          {
            isolationLevel:
              Prisma
                .TransactionIsolationLevel
                .RepeatableRead,
          },
        )

      res.json({
        users,
        total,
        page: pageNumber,
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

// PATCH /api/admin/users/:id/status
adminUsersRouter.patch(
  '/:id/status',
  async (req, res, next) => {
    const admin =
      res.locals.admin as {
        id: string
        name: string
        email: string
      }

    const id =
      req.params.id

    if (
      typeof id !== 'string' ||
      !uuidPattern.test(id)
    ) {
      res.status(400).json({
        message:
          'Invalid user ID.',
      })
      return
    }

    const allowedOrigin =
      process.env
        .FRONTEND_ORIGIN ??
      'http://localhost:5173'

    const origin =
      req.get('origin')

    if (
      (
        origin &&
        origin !==
          allowedOrigin
      ) ||
      req.get(
        'sec-fetch-site',
      ) === 'cross-site'
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

    const body = req.body

    if (
      !body ||
      typeof body !==
        'object' ||
      Array.isArray(body)
    ) {
      res.status(400).json({
        message:
          'Invalid request.',
      })
      return
    }

    const keys =
      Object.keys(body)

    if (
      keys.length !== 1 ||
      keys[0] !== 'status'
    ) {
      res.status(400).json({
        message:
          'Only status may be changed here.',
      })
      return
    }

    const nextStatus =
      body.status

    if (
      nextStatus !==
        'ACTIVE' &&
      nextStatus !==
        'SUSPENDED'
    ) {
      res.status(400).json({
        message:
          'Status must be ACTIVE or SUSPENDED.',
      })
      return
    }

    if (
      id === admin.id
    ) {
      res.status(400).json({
        message:
          'You cannot suspend your own administrator account.',
      })
      return
    }

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const currentAdmin =
              await tx.user
                .findUnique({
                  where: {
                    id:
                      admin.id,
                  },

                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                  },
                })

            if (
              !currentAdmin ||
              currentAdmin
                .role !==
                'ADMIN' ||
              currentAdmin
                .status !==
                'ACTIVE'
            ) {
              throw new AdminUserError(
                403,
                'Administrator access is required.',
              )
            }

            const user =
              await tx.user
                .findUnique({
                  where: {
                    id,
                  },

                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                  },
                })

            if (!user) {
              throw new AdminUserError(
                404,
                'User not found.',
              )
            }

            if (
              user.status ===
              nextStatus
            ) {
              return {
                changed: false,
                user,
              }
            }

            if (
              user.role ===
                'ADMIN' &&
              nextStatus ===
                'SUSPENDED'
            ) {
              const activeAdmins =
                await tx.user.count(
                  {
                    where: {
                      role:
                        'ADMIN',

                      status:
                        'ACTIVE',
                    },
                  },
                )

              if (
                activeAdmins <= 1
              ) {
                throw new AdminUserError(
                  409,
                  'The last active administrator cannot be suspended.',
                )
              }
            }

            const updated =
              await tx.user.update(
                {
                  where: {
                    id,
                  },

                  data: {
                    status:
                      nextStatus as
                        AccountStatus,
                  },

                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              )

            await tx.auditEvent
              .create({
                data: {
                  actorId:
                    currentAdmin.id,

                  actorLabel:
                    `${currentAdmin.name} <${currentAdmin.email}>`
                      .slice(
                        0,
                        150,
                      ),

                  action:
                    nextStatus ===
                    'SUSPENDED'
                      ? 'USER_SUSPENDED'
                      : 'USER_REACTIVATED',

                  entityType:
                    'USER',

                  entityId:
                    user.id,

                  details: {
                    previousStatus:
                      user.status,

                    newStatus:
                      nextStatus,

                    targetRole:
                      user.role,

                    targetEmail:
                      user.email,
                  },
                },
              })

            return {
              changed: true,
              user: updated,
            }
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
          result.changed
            ? result.user
                  .status ===
                'SUSPENDED'
              ? 'User suspended successfully.'
              : 'User reactivated successfully.'
            : 'User already has that status.',

        user:
          result.user,
      })
    } catch (error) {
      if (
        error instanceof
        AdminUserError
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
        error.code ===
          'P2034'
      ) {
        res.status(409).json({
          message:
            'Another administrator changed this account. Refresh and try again.',
        })
        return
      }

      next(error)
    }
  },
)
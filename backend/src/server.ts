import { petsRouter } from './pets.js'
import express from 'express'
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express'
import * as argon2 from 'argon2'
import { rateLimit } from 'express-rate-limit'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import { authRouter, sessionMiddleware } from './auth.js'
import { articlesRouter } from './articles.js'
import { breedsRouter } from './breeds.js'
import { adminArticlesRouter } from './admin-articles.js'
import { vetsRouter } from './vets.js'
import { adminVetsRouter } from './admin-vets.js'
import { providerVetsRouter } from './provider-vets.js'
import { appointmentsRouter } from './appointments.js'
import { providerAppointmentsRouter } from './provider-appointments.js'
import { providerAvailabilityRouter } from './provider-availability.js'
import { notificationsRouter } from './notifications.js'
import { ambulancesRouter } from './ambulances.js'
import { adminAmbulancesRouter } from './admin-ambulances.js'
import { adminIssueReportsRouter } from './admin-issue-reports.js'
import { providerAmbulancesRouter } from './provider-ambulances.js'
import { transportRequestsRouter } from './transport-requests.js'
import { issueReportsRouter } from './issue-reports.js'
import { chatbotRouter } from './chatbot.js'
import { startTransportExpiryWorker } from './transport-expiry.js'
import {
  adminUsersRouter,
} from './admin-users.js'

declare module 'express-session' {
  interface SessionData {
    adminMfaVerified?: boolean
  }
}

const app = express()
const port = Number(process.env.PORT ?? 5000)

const chatbotLimiter =
  rateLimit({
    windowMs:
      10 *
      60 *
      1000,

    limit: 30,

    standardHeaders:
      'draft-8',

    legacyHeaders: false,

    message: {
      message:
        'Too many chatbot requests. Please wait before trying again.',
    },
  })

const registrationLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit: 10,

    standardHeaders:
      'draft-8',

    legacyHeaders: false,

    message: {
      message:
        'Too many registration attempts. Please try again later.',
    },
  })

async function requireAdminMfa(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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
    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          role: true,
          status: true,
          mfaEnabled: true,
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

    if (user.role !== 'ADMIN') {
      res.status(403).json({
        message:
          'Administrator access is required.',
      })

      return
    }

    if (!user.mfaEnabled) {
      res.status(403).json({
        message:
          'Administrator multi-factor authentication must be enabled before using admin tools.',
        code:
          'ADMIN_MFA_SETUP_REQUIRED',
      })

      return
    }

    if (
      req.session
        .adminMfaVerified !==
      true
    ) {
      res.status(401).json({
        message:
          'Please sign in again and complete administrator multi-factor authentication.',
        code:
          'ADMIN_MFA_VERIFICATION_REQUIRED',
      })

      return
    }

    next()
  } catch (error) {
    next(error)
  }
}

app.disable(
  'x-powered-by',
)

app.use(
  express.json({
    limit: '256kb',
  }),
)

app.use(
  '/api/auth',
  sessionMiddleware,
  authRouter,
)

app.use(
  '/api/pets',
  sessionMiddleware,
  petsRouter,
)

app.use(
  '/api/articles',
  articlesRouter,
)

app.use(
  '/api/breeds',
  breedsRouter,
)

app.use(
  '/api/vets',
  vetsRouter,
)

app.use(
  '/api/ambulances',
  ambulancesRouter,
)

app.use(
  '/api/provider/vet',
  sessionMiddleware,
  providerVetsRouter,
)

app.use(
  '/api/admin/vets',
  sessionMiddleware,
  requireAdminMfa,
  adminVetsRouter,
)

app.use(
  '/api/admin/users',
  sessionMiddleware,
  requireAdminMfa,
  adminUsersRouter,
)

app.use(
  '/api/appointments',
  sessionMiddleware,
  appointmentsRouter,
)

app.use(
  '/api/admin/articles',
  sessionMiddleware,
  requireAdminMfa,
  adminArticlesRouter,
)

app.use(
  '/api/provider/appointments',
  sessionMiddleware,
  providerAppointmentsRouter,
)

app.use(
  '/api/provider/availability',
  sessionMiddleware,
  providerAvailabilityRouter,
)

app.use(
  '/api/notifications',
  sessionMiddleware,
  notificationsRouter,
)

app.use(
  '/api/admin/ambulances',
  sessionMiddleware,
  requireAdminMfa,
  adminAmbulancesRouter,
)

app.use(
  '/api/provider/ambulance',
  sessionMiddleware,
  providerAmbulancesRouter,
)

app.use(
  '/api/transport-requests',
  sessionMiddleware,
  transportRequestsRouter,
)

app.use(
  '/api/issue-reports',
  sessionMiddleware,
  issueReportsRouter,
)

app.use(
  '/api/admin/issue-reports',
  sessionMiddleware,
  requireAdminMfa,
  adminIssueReportsRouter,
)

app.use(
  '/api/chatbot',
  sessionMiddleware,
  chatbotLimiter,
  chatbotRouter,
)

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      status: 'ok',
      message:
        'Purr-Pawsitive backend is running',
    })
  },
)

app.post(
  '/api/auth/register',
  registrationLimiter,
  async (req, res) => {
    const body =
      req.body

    if (
      !body ||
      typeof body.name !==
        'string' ||
      typeof body.email !==
        'string' ||
      typeof body.password !==
        'string'
    ) {
      res.status(400).json({
        message:
          'Name, email, and password are required.',
      })

      return
    }

    const name =
      body.name.trim()

    const email =
      body.email
        .trim()
        .toLowerCase()

    const password =
      body.password

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      res.status(400).json({
        message:
          'Name must contain between 2 and 100 characters.',
      })

      return
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      res.status(400).json({
        message:
          'Enter a valid email address.',
      })

      return
    }

    if (
      password.length < 15 ||
      password.length > 128
    ) {
      res.status(400).json({
        message:
          'Password must contain between 15 and 128 characters.',
      })

      return
    }

    try {
      const passwordHash =
        await argon2.hash(
          password,
          {
            type:
              argon2.argon2id,
          },
        )

      const user =
        await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: 'OWNER',
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })

      res.status(201).json({
        message:
          'Account created successfully.',

        user,
      })
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          message:
            'An account with that email already exists.',
        })

        return
      }

      // Log an error identifier without passwords
      // or request contents.
      console.error(
        'Registration failed:',
        error instanceof
          Prisma.PrismaClientKnownRequestError
          ? error.code
          : 'Unexpected error',
      )

      res.status(500).json({
        message:
          'Unable to create your account. Please try again later.',
      })
    }
  },
)

app.use(
  (_req, res) => {
    res.status(404).json({
      message:
        'API route not found',
    })
  },
)

const handleError:
  ErrorRequestHandler =
  (
    error,
    _req,
    res,
    _next,
  ) => {
    if (
      error?.type ===
      'entity.parse.failed'
    ) {
      res.status(400).json({
        message:
          'Request contains invalid JSON.',
      })

      return
    }

    if (
      error?.type ===
      'entity.too.large'
    ) {
      res.status(413).json({
        message:
          'Request is too large.',
      })

      return
    }

    console.error(
      'Unhandled API error:',
      {
        name:
          error instanceof
            Error
            ? error.name
            : 'UnknownError',

        code:
          error instanceof
            Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,

        table:
          error instanceof
            Prisma.PrismaClientKnownRequestError
            ? error.meta
                ?.table
            : undefined,

        model:
          error instanceof
            Prisma.PrismaClientKnownRequestError
            ? error.meta
                ?.modelName
            : undefined,

        stack:
          error instanceof
            Error
            ? error.stack
                ?.split('\n')
                .filter(
                  (line) =>
                    line
                      .trim()
                      .startsWith(
                        'at ',
                      ),
                )
                .slice(
                  0,
                  6,
                )
                .join(
                  '\n',
                )
            : undefined,
      },
    )

    res.status(500).json({
      message:
        'An unexpected server error occurred.',
    })
  }

app.use(
  handleError,
)

async function startServer() {
  try {
    await prisma.$connect()

    app.listen(
      port,
      '0.0.0.0',
      () => {
        console.log(
          `Backend running at http://localhost:${port}`,
        )

        console.log(
          'PostgreSQL connected through Prisma',
        )

        startTransportExpiryWorker()
      },
    )
  } catch {
    console.error(
      'Database connection failed. Check PostgreSQL and .env.',
    )

    await prisma.$disconnect()

    process.exitCode = 1
  }
}

void startServer()

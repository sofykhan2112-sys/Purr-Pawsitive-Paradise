import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

import dotenv from 'dotenv'
import { Router } from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import * as argon2 from 'argon2'
import { rateLimit } from 'express-rate-limit'
import { prisma } from './db.js'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    mfaChallengeUserId?: string
    mfaChallengeExpiresAt?: number
    adminMfaVerified?: boolean
  }
}

dotenv.config()

const secret =
  process.env.SESSION_SECRET

if (!secret || secret.length < 32) {
  throw new Error(
    'Set a strong SESSION_SECRET in backend/.env',
  )
}

const mfaEncryptionSecret =
  process.env.MFA_ENCRYPTION_KEY

if (
  !mfaEncryptionSecret ||
  mfaEncryptionSecret.length < 32
) {
  throw new Error(
    'Set a strong MFA_ENCRYPTION_KEY in backend/.env',
  )
}

const mfaEncryptionKey =
  createHash('sha256')
    .update(mfaEncryptionSecret)
    .digest()

const PgSessionStore =
  connectPgSimple(session)

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable')
  }
  
  const sessionPool =
    new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
    })

sessionPool.on('error', () => {
  console.error(
    'Session database connection error',
  )
})

const production =
  process.env.NODE_ENV === 'production'

const frontendOrigin =
  process.env.FRONTEND_ORIGIN ??
  'http://localhost:5173'

const cookieSettings = {
  httpOnly: true,
  secure: production,
  sameSite: 'lax' as const,
  path: '/',
}

export const sessionMiddleware =
  session({
    name: 'purr.sid',
    secret,

    store:
      new PgSessionStore({
        pool: sessionPool,
        tableName: 'session',
        createTableIfMissing: false,
      }),

    resave: false,
    saveUninitialized: false,

    cookie: {
      ...cookieSettings,

      maxAge:
        24 *
        60 *
        60 *
        1000,
    },
  })

export const authRouter =
  Router()

// ======================================================
// PASSWORD RESET HELPERS
// ======================================================

function hashResetToken(
  token: string,
) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

// ======================================================
// MFA RECOVERY CODE HELPERS
// ======================================================

function normalizeMfaRecoveryCode(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '')
}

function hashMfaRecoveryCode(
  value: string,
) {
  return createHash('sha256')
    .update(
      normalizeMfaRecoveryCode(
        value,
      ),
    )
    .digest('hex')
}

function createMfaRecoveryCodes() {
  const recoveryCodes =
    Array.from(
      {
        length: 10,
      },
      () => {
        const raw =
          randomBytes(10)
            .toString('hex')
            .toUpperCase()

        return (
          raw
            .match(/.{1,4}/g)
            ?.join('-') ??
          raw
        )
      },
    )

  return {
    recoveryCodes,

    recoveryCodeHashes:
      recoveryCodes.map(
        hashMfaRecoveryCode,
      ),
  }
}

// ======================================================
// TOTP HELPERS
// ======================================================

const base32Alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function encodeBase32(
  input: Buffer,
) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of input) {
    value =
      (value << 8) |
      byte

    bits += 8

    while (bits >= 5) {
      output +=
        base32Alphabet[
          (value >>
            (bits - 5)) &
            31
        ]

      bits -= 5
    }
  }

  if (bits > 0) {
    output +=
      base32Alphabet[
        (value <<
          (5 - bits)) &
          31
      ]
  }

  return output
}

function decodeBase32(
  input: string,
) {
  const normalized =
    input
      .toUpperCase()
      .replace(/=+$/g, '')
      .replace(/\s+/g, '')

  let bits = 0
  let value = 0

  const bytes: number[] = []

  for (
    const character
    of normalized
  ) {
    const index =
      base32Alphabet.indexOf(
        character,
      )

    if (index === -1) {
      throw new Error(
        'Invalid Base32 secret.',
      )
    }

    value =
      (value << 5) |
      index

    bits += 5

    if (bits >= 8) {
      bytes.push(
        (value >>
          (bits - 8)) &
          255,
      )

      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function generateTotp(
  secretValue: string,
  timestamp = Date.now(),
) {
  const counter =
    Math.floor(
      timestamp /
        1000 /
        30,
    )

  const counterBuffer =
    Buffer.alloc(8)

  counterBuffer.writeBigUInt64BE(
    BigInt(counter),
  )

  const digest =
    createHmac(
      'sha1',
      decodeBase32(
        secretValue,
      ),
    )
      .update(
        counterBuffer,
      )
      .digest()

  const offset =
    digest[
      digest.length - 1
    ] & 0x0f

  const binary =
    (
      (
        digest[offset] &
        0x7f
      ) <<
      24
    ) |
    (
      digest[offset + 1] <<
      16
    ) |
    (
      digest[offset + 2] <<
      8
    ) |
    digest[offset + 3]

  return String(
    binary %
      1_000_000,
  ).padStart(
    6,
    '0',
  )
}

function verifyTotp(
  secretValue: string,
  code: string,
) {
  if (
    !/^\d{6}$/.test(
      code,
    )
  ) {
    return false
  }

  for (
    const offset
    of [-1, 0, 1]
  ) {
    const expected =
      generateTotp(
        secretValue,

        Date.now() +
          offset *
            30_000,
      )

    const expectedBuffer =
      Buffer.from(
        expected,
      )

    const providedBuffer =
      Buffer.from(code)

    if (
      expectedBuffer.length ===
        providedBuffer.length &&
      timingSafeEqual(
        expectedBuffer,
        providedBuffer,
      )
    ) {
      return true
    }
  }

  return false
}

// ======================================================
// MFA SECRET ENCRYPTION
// ======================================================

function encryptMfaSecret(
  value: string,
) {
  const iv =
    randomBytes(12)

  const cipher =
    createCipheriv(
      'aes-256-gcm',
      mfaEncryptionKey,
      iv,
    )

  const ciphertext =
    Buffer.concat([
      cipher.update(
        value,
        'utf8',
      ),

      cipher.final(),
    ])

  const tag =
    cipher.getAuthTag()

  return {
    ciphertext:
      ciphertext.toString(
        'base64',
      ),

    iv:
      iv.toString('hex'),

    tag:
      tag.toString('hex'),
  }
}

function decryptMfaSecret({
  ciphertext,
  iv,
  tag,
}: {
  ciphertext: string
  iv: string
  tag: string
}) {
  const decipher =
    createDecipheriv(
      'aes-256-gcm',
      mfaEncryptionKey,

      Buffer.from(
        iv,
        'hex',
      ),
    )

  decipher.setAuthTag(
    Buffer.from(
      tag,
      'hex',
    ),
  )

  const plaintext =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          ciphertext,
          'base64',
        ),
      ),

      decipher.final(),
    ])

  return plaintext.toString(
    'utf8',
  )
}

function adminMfaConfigurationValid(
  user: {
    mfaSecretCiphertext:
      | string
      | null

    mfaSecretIv:
      | string
      | null

    mfaSecretTag:
      | string
      | null
  },
) {
  return Boolean(
    user.mfaSecretCiphertext &&
      user.mfaSecretIv &&
      user.mfaSecretTag,
  )
}

// ======================================================
// SESSION HELPERS
// ======================================================

async function regenerateSession(
  req: Parameters<
    Parameters<
      typeof authRouter.post
    >[1]
  >[0],
) {
  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      req.session.regenerate(
        (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        },
      )
    },
  )
}

async function saveSession(
  req: Parameters<
    Parameters<
      typeof authRouter.post
    >[1]
  >[0],
) {
  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      req.session.save(
        (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        },
      )
    },
  )
}

// ======================================================
// ORIGIN / CONTENT-TYPE PROTECTION
// ======================================================

authRouter.use(
  (
    req,
    res,
    next,
  ) => {
    if (
      req.method === 'POST' ||
      req.method === 'PATCH' ||
      req.method === 'DELETE'
    ) {
      const origin =
        req.get('origin')

      if (
        (
          origin &&
          origin !==
            frontendOrigin
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
    }

    next()
  },
)

// ======================================================
// RATE LIMITS
// ======================================================

const loginLimiter =
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
        'Too many login attempts. Please try again later.',
    },
  })

const mfaLimiter =
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
        'Too many MFA attempts. Please try again later.',
    },
  })

const forgotPasswordLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit: 5,

    standardHeaders:
      'draft-8',

    legacyHeaders: false,

    message: {
      message:
        'Too many reset requests. Please try again later.',
    },
  })

const resetPasswordLimiter =
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
        'Too many reset attempts. Please try again later.',
    },
  })

// ======================================================
// LOGIN
// ======================================================

authRouter.post(
  '/login',
  loginLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const {
        email,
        password,
      } =
        req.body ?? {}

      if (
        typeof email !==
          'string' ||
        typeof password !==
          'string' ||
        email.trim().length ===
          0 ||
        email.length > 254 ||
        password.length === 0 ||
        password.length > 128
      ) {
        res.status(400).json({
          message:
            'Enter a valid email and password.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              email:
                email
                  .trim()
                  .toLowerCase(),
            },
          })

      const passwordMatches =
        user
          ? await argon2.verify(
              user.passwordHash,
              password,
            )
          : false

      if (
        !user ||
        !passwordMatches ||
        user.status !==
          'ACTIVE'
      ) {
        res.status(401).json({
          message:
            'Incorrect email or password, or account unavailable.',
        })

        return
      }

      if (
        user.role ===
          'ADMIN' &&
        user.mfaEnabled
      ) {
        if (
          !adminMfaConfigurationValid(
            user,
          )
        ) {
          res.status(500).json({
            message:
              'Administrator MFA is not configured correctly. Contact the system operator.',
          })

          return
        }

        await regenerateSession(
          req,
        )

        req.session
          .mfaChallengeUserId =
          user.id

        req.session
          .mfaChallengeExpiresAt =
          Date.now() +
          5 *
            60 *
            1000

        await saveSession(req)

        res.setHeader(
          'Cache-Control',
          'no-store',
        )

        res.json({
          message:
            'Enter the 6-digit code from your authenticator app or one of your recovery codes.',

          mfaRequired: true,

          recoveryCodeSupported:
            true,
        })

        return
      }

      await regenerateSession(
        req,
      )

      req.session.userId =
        user.id

      await saveSession(req)

      res.json({
        message:
          'Logged in successfully.',

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },

        mfaSetupRecommended:
          user.role ===
            'ADMIN' &&
          !user.mfaEnabled,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// VERIFY ADMIN MFA LOGIN
// ======================================================

authRouter.post(
  '/mfa/verify-login',
  mfaLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const code =
        req.body?.code

      if (
        typeof code !==
        'string'
      ) {
        res.status(400).json({
          message:
            'Enter your authenticator code or recovery code.',
        })

        return
      }

      const trimmedCode =
        code.trim()

      const normalizedRecoveryCode =
        normalizeMfaRecoveryCode(
          trimmedCode,
        )

      const isTotpCode =
        /^\d{6}$/.test(
          trimmedCode,
        )

      const isRecoveryCode =
        /^[A-F0-9]{20}$/.test(
          normalizedRecoveryCode,
        )

      if (
        !isTotpCode &&
        !isRecoveryCode
      ) {
        res.status(400).json({
          message:
            'Enter a valid 6-digit authenticator code or recovery code.',
        })

        return
      }

      const userId =
        req.session
          .mfaChallengeUserId

      const expiresAt =
        req.session
          .mfaChallengeExpiresAt

      if (
        !userId ||
        !expiresAt ||
        expiresAt <=
          Date.now()
      ) {
        delete req.session
          .mfaChallengeUserId

        delete req.session
          .mfaChallengeExpiresAt

        res.status(401).json({
          message:
            'The MFA challenge expired. Sign in again.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              id: userId,
            },
          })

      if (
        !user ||
        user.status !==
          'ACTIVE' ||
        user.role !==
          'ADMIN' ||
        !user.mfaEnabled ||
        !adminMfaConfigurationValid(
          user,
        )
      ) {
        res.status(401).json({
          message:
            'The administrator account is unavailable.',
        })

        return
      }

      let authenticationMethod:
        | 'TOTP'
        | 'RECOVERY_CODE'

      if (isTotpCode) {
        const secretValue =
          decryptMfaSecret({
            ciphertext:
              user
                .mfaSecretCiphertext!,

            iv:
              user
                .mfaSecretIv!,

            tag:
              user
                .mfaSecretTag!,
          })

        if (
          !verifyTotp(
            secretValue,
            trimmedCode,
          )
        ) {
          res.status(401).json({
            message:
              'Incorrect authenticator code.',
          })

          return
        }

        authenticationMethod =
          'TOTP'
      } else {
        const recoveryCodeHash =
          hashMfaRecoveryCode(
            normalizedRecoveryCode,
          )

        const consumed =
          await prisma
            .$transaction(
              async (tx) => {
                // Atomic PostgreSQL removal prevents the same
                // recovery code from being successfully reused.
                const changed =
                  await tx.$executeRaw`
                    UPDATE "users"
                    SET "mfaRecoveryCodeHashes" =
                      array_remove(
                        "mfaRecoveryCodeHashes",
                        ${recoveryCodeHash}
                      )
                    WHERE "id" = ${user.id}::uuid
                      AND ${recoveryCodeHash} =
                        ANY("mfaRecoveryCodeHashes")
                  `

                if (changed !== 1) {
                  return {
                    success:
                      false,

                    remaining:
                      0,
                  }
                }

                const updatedUser =
                  await tx.user
                    .findUnique({
                      where: {
                        id:
                          user.id,
                      },

                      select: {
                        mfaRecoveryCodeHashes:
                          true,
                      },
                    })

                const remaining =
                  updatedUser
                    ?.mfaRecoveryCodeHashes
                    .length ??
                  0

                await tx.auditEvent
                  .create({
                    data: {
                      actorId:
                        user.id,

                      actorLabel:
                        `${user.name} <${user.email}>`
                          .slice(
                            0,
                            150,
                          ),

                      action:
                        'ADMIN_MFA_RECOVERY_CODE_USED',

                      entityType:
                        'USER',

                      entityId:
                        user.id,

                      details: {
                        remainingRecoveryCodes:
                          remaining,
                      },
                    },
                  })

                return {
                  success:
                    true,

                  remaining,
                }
              },
            )

        if (!consumed.success) {
          res.status(401).json({
            message:
              'Incorrect or already-used recovery code.',
          })

          return
        }

        authenticationMethod =
          'RECOVERY_CODE'
      }

      await regenerateSession(
        req,
      )

      req.session.userId =
        user.id

      req.session.adminMfaVerified =
        true

      delete req.session
        .mfaChallengeUserId

      delete req.session
        .mfaChallengeExpiresAt

      await saveSession(req)

      await prisma.auditEvent
        .create({
          data: {
            actorId:
              user.id,

            actorLabel:
              `${user.name} <${user.email}>`
                .slice(
                  0,
                  150,
                ),

            action:
              'ADMIN_MFA_LOGIN_COMPLETED',

            entityType:
              'USER',

            entityId:
              user.id,

            details: {
              method:
                authenticationMethod,
            },
          },
        })

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        message:
          authenticationMethod ===
          'RECOVERY_CODE'
            ? 'Logged in successfully using a recovery code. That recovery code has now been permanently used.'
            : 'Logged in successfully.',

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },

        recoveryCodeUsed:
          authenticationMethod ===
          'RECOVERY_CODE',
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// START MFA SETUP
// ======================================================

authRouter.post(
  '/mfa/setup',
  mfaLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        req.session.userId

      if (!userId) {
        res.status(401).json({
          message:
            'Please sign in.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              id: userId,
            },
          })

      if (
        !user ||
        user.status !==
          'ACTIVE'
      ) {
        res.status(401).json({
          message:
            'Please sign in with an active account.',
        })

        return
      }

      if (
        user.role !==
          'ADMIN'
      ) {
        res.status(403).json({
          message:
            'Administrator access is required.',
        })

        return
      }

      if (user.mfaEnabled) {
        res.status(409).json({
          message:
            'Multi-factor authentication is already enabled.',
        })

        return
      }

      const manualSecret =
        encodeBase32(
          randomBytes(20),
        )

      const encrypted =
        encryptMfaSecret(
          manualSecret,
        )

      const issuer =
        'Purr-Pawsitive Paradise'

      const accountLabel =
        `${issuer}:${user.email}`

      const otpauthUri =
        `otpauth://totp/${encodeURIComponent(
          accountLabel,
        )}` +
        `?secret=${encodeURIComponent(
          manualSecret,
        )}` +
        `&issuer=${encodeURIComponent(
          issuer,
        )}` +
        '&algorithm=SHA1' +
        '&digits=6' +
        '&period=30'

      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: user.id,
            },

            data: {
              mfaEnabled:
                false,

              mfaSecretCiphertext:
                encrypted.ciphertext,

              mfaSecretIv:
                encrypted.iv,

              mfaSecretTag:
                encrypted.tag,

              mfaVerifiedAt:
                null,

              mfaRecoveryCodeHashes:
                {
                  set: [],
                },
            },
          })

          await tx.auditEvent
            .create({
              data: {
                actorId:
                  user.id,

                actorLabel:
                  `${user.name} <${user.email}>`
                    .slice(
                      0,
                      150,
                    ),

                action:
                  'ADMIN_MFA_SETUP_STARTED',

                entityType:
                  'USER',

                entityId:
                  user.id,

                details: {
                  method:
                    'TOTP',
                },
              },
            })
        },
      )

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        message:
          'Authenticator setup started. Add the account, then confirm a 6-digit code.',

        otpauthUri,
        manualSecret,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// ENABLE MFA
// ======================================================

authRouter.post(
  '/mfa/enable',
  mfaLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        req.session.userId

      const code =
        req.body?.code

      if (!userId) {
        res.status(401).json({
          message:
            'Please sign in.',
        })

        return
      }

      if (
        typeof code !==
          'string' ||
        !/^\d{6}$/.test(
          code.trim(),
        )
      ) {
        res.status(400).json({
          message:
            'Enter the 6-digit authenticator code.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              id: userId,
            },
          })

      if (
        !user ||
        user.status !==
          'ACTIVE'
      ) {
        res.status(401).json({
          message:
            'Please sign in with an active account.',
        })

        return
      }

      if (
        user.role !==
          'ADMIN'
      ) {
        res.status(403).json({
          message:
            'Administrator access is required.',
        })

        return
      }

      if (user.mfaEnabled) {
        res.status(409).json({
          message:
            'Multi-factor authentication is already enabled.',
        })

        return
      }

      if (
        !adminMfaConfigurationValid(
          user,
        )
      ) {
        res.status(409).json({
          message:
            'Start authenticator setup before confirming a code.',
        })

        return
      }

      const secretValue =
        decryptMfaSecret({
          ciphertext:
            user
              .mfaSecretCiphertext!,

          iv:
            user
              .mfaSecretIv!,

          tag:
            user
              .mfaSecretTag!,
        })

      if (
        !verifyTotp(
          secretValue,
          code.trim(),
        )
      ) {
        res.status(401).json({
          message:
            'Incorrect authenticator code.',
        })

        return
      }

      const now =
        new Date()

      const {
        recoveryCodes,
        recoveryCodeHashes,
      } =
        createMfaRecoveryCodes()

      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: user.id,
            },

            data: {
              mfaEnabled:
                true,

              mfaVerifiedAt:
                now,

              mfaRecoveryCodeHashes:
                {
                  set:
                    recoveryCodeHashes,
                },
            },
          })

          await tx.auditEvent
            .create({
              data: {
                actorId:
                  user.id,

                actorLabel:
                  `${user.name} <${user.email}>`
                    .slice(
                      0,
                      150,
                    ),

                action:
                  'ADMIN_MFA_ENABLED',

                entityType:
                  'USER',

                entityId:
                  user.id,

                details: {
                  method:
                    'TOTP',

                  verifiedAt:
                    now.toISOString(),

                  recoveryCodeCount:
                    recoveryCodes.length,
                },
              },
            })
        },
      )

      req.session.adminMfaVerified =
        true

      await saveSession(req)

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        message:
          'Multi-factor authentication is enabled. Save these recovery codes somewhere secure. They will not be shown again.',

        recoveryCodes,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// REGENERATE ADMIN MFA RECOVERY CODES
// ======================================================

authRouter.post(
  '/mfa/recovery-codes/regenerate',
  mfaLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        req.session.userId

      const code =
        req.body?.code

      if (!userId) {
        res.status(401).json({
          message:
            'Please sign in.',
        })

        return
      }

      if (
        req.session
          .adminMfaVerified !==
        true
      ) {
        res.status(403).json({
          message:
            'Complete administrator MFA before managing recovery codes.',
        })

        return
      }

      if (
        typeof code !==
          'string' ||
        !/^\d{6}$/.test(
          code.trim(),
        )
      ) {
        res.status(400).json({
          message:
            'Enter the current 6-digit authenticator code.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              id: userId,
            },
          })

      if (
        !user ||
        user.status !==
          'ACTIVE' ||
        user.role !==
          'ADMIN' ||
        !user.mfaEnabled ||
        !adminMfaConfigurationValid(
          user,
        )
      ) {
        res.status(403).json({
          message:
            'Administrator MFA is unavailable.',
        })

        return
      }

      const secretValue =
        decryptMfaSecret({
          ciphertext:
            user
              .mfaSecretCiphertext!,

          iv:
            user
              .mfaSecretIv!,

          tag:
            user
              .mfaSecretTag!,
        })

      if (
        !verifyTotp(
          secretValue,
          code.trim(),
        )
      ) {
        res.status(401).json({
          message:
            'Incorrect authenticator code.',
        })

        return
      }

      const {
        recoveryCodes,
        recoveryCodeHashes,
      } =
        createMfaRecoveryCodes()

      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: user.id,
            },

            data: {
              mfaRecoveryCodeHashes:
                {
                  set:
                    recoveryCodeHashes,
                },
            },
          })

          await tx.auditEvent
            .create({
              data: {
                actorId:
                  user.id,

                actorLabel:
                  `${user.name} <${user.email}>`
                    .slice(
                      0,
                      150,
                    ),

                action:
                  'ADMIN_MFA_RECOVERY_CODES_REGENERATED',

                entityType:
                  'USER',

                entityId:
                  user.id,

                details: {
                  recoveryCodeCount:
                    recoveryCodes.length,
                },
              },
            })
        },
      )

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        message:
          'New recovery codes were generated. All previous recovery codes are now invalid. Save these codes securely because they will not be shown again.',

        recoveryCodes,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// CURRENT USER
// ======================================================

authRouter.get(
  '/me',
  async (
    req,
    res,
    next,
  ) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    try {
      if (
        !req.session.userId
      ) {
        res.status(401).json({
          message:
            'Please sign in.',
        })

        return
      }

      const user =
        await prisma.user
          .findUnique({
            where: {
              id:
                req.session
                  .userId,
            },

            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,

              mfaEnabled:
                true,

              mfaVerifiedAt:
                true,

              mfaRecoveryCodeHashes:
                true,
            },
          })

      if (
        !user ||
        user.status !==
          'ACTIVE'
      ) {
        req.session.destroy(
          (error) => {
            if (error) {
              next(error)
              return
            }

            res.clearCookie(
              'purr.sid',
              cookieSettings,
            )

            res.status(401).json({
              message:
                'Please sign in again.',
            })
          },
        )

        return
      }

      const {
        mfaRecoveryCodeHashes,
        ...safeUser
      } = user

      res.json({
        user: {
          ...safeUser,

          recoveryCodesRemaining:
            user.role ===
            'ADMIN'
              ? mfaRecoveryCodeHashes
                  .length
              : undefined,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// FORGOT PASSWORD
// ======================================================

authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const { email } =
        req.body ?? {}

      if (
        typeof email !==
          'string' ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email.trim(),
        )
      ) {
        res.status(400).json({
          message:
            'Enter a valid email address.',
        })

        return
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase()

      const rawToken =
        randomBytes(
          32,
        ).toString('hex')

      const tokenHash =
        hashResetToken(
          rawToken,
        )

      const user =
        await prisma.user
          .findUnique({
            where: {
              email:
                normalizedEmail,
            },

            select: {
              id: true,
              status: true,
            },
          })

      if (
        user &&
        user.status ===
          'ACTIVE'
      ) {
        const expiresAt =
          new Date(
            Date.now() +
              30 *
                60 *
                1000,
          )

        await prisma.$transaction(
          async (tx) => {
            await tx
              .passwordResetToken
              .deleteMany({
                where: {
                  userId:
                    user.id,
                },
              })

            await tx
              .passwordResetToken
              .deleteMany({
                where: {
                  expiresAt: {
                    lte:
                      new Date(),
                  },
                },
              })

            await tx
              .passwordResetToken
              .create({
                data: {
                  userId:
                    user.id,

                  tokenHash,

                  expiresAt,
                },
              })
          },
        )
      }

      const result: {
        message: string

        developmentResetToken?:
          string

        developmentResetUrl?:
          string
      } = {
        message:
          'If an active account exists for that email, reset instructions are available.',
      }

      if (
        !production &&
        user &&
        user.status ===
          'ACTIVE'
      ) {
        result.developmentResetToken =
          rawToken

        result.developmentResetUrl =
          `${frontendOrigin}/reset-password?token=${encodeURIComponent(
            rawToken,
          )}`
      }

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// RESET PASSWORD
// ======================================================

authRouter.post(
  '/reset-password',
  resetPasswordLimiter,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const {
        token,
        password,
      } =
        req.body ?? {}

      if (
        typeof token !==
          'string' ||
        !/^[0-9a-f]{64}$/i.test(
          token,
        )
      ) {
        res.status(400).json({
          message:
            'This reset link is invalid or expired.',
        })

        return
      }

      if (
        typeof password !==
          'string' ||
        password.length < 15 ||
        password.length > 128
      ) {
        res.status(400).json({
          message:
            'Password must contain between 15 and 128 characters.',
        })

        return
      }

      const normalizedToken =
        token.toLowerCase()

      const tokenHash =
        hashResetToken(
          normalizedToken,
        )

      const record =
        await prisma
          .passwordResetToken
          .findUnique({
            where: {
              tokenHash,
            },

            select: {
              id: true,
              userId: true,
              expiresAt: true,

              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  status: true,
                },
              },
            },
          })

      const now =
        new Date()

      if (
        !record ||
        record.expiresAt <=
          now ||
        record.user.status !==
          'ACTIVE'
      ) {
        if (record) {
          await prisma
            .passwordResetToken
            .delete({
              where: {
                id:
                  record.id,
              },
            })
            .catch(
              () => undefined,
            )
        }

        res.status(400).json({
          message:
            'This reset link is invalid or expired.',
        })

        return
      }

      const passwordHash =
        await argon2.hash(
          password,
          {
            type:
              argon2.argon2id,
          },
        )

      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id:
                record.userId,
            },

            data: {
              passwordHash,
            },
          })

          await tx
            .passwordResetToken
            .deleteMany({
              where: {
                userId:
                  record.userId,
              },
            })

          await tx.session
            .deleteMany({
              where: {
                sess: {
                  path: [
                    'userId',
                  ],

                  equals:
                    record.userId,
                },
              },
            })

          await tx.auditEvent
            .create({
              data: {
                actorId:
                  record.userId,

                actorLabel:
                  `${record.user.name} <${record.user.email}>`
                    .slice(
                      0,
                      150,
                    ),

                action:
                  'PASSWORD_RESET_COMPLETED',

                entityType:
                  'USER',

                entityId:
                  record.userId,

                details: {
                  method:
                    'RESET_TOKEN',
                },
              },
            })
        },
      )

      res.clearCookie(
        'purr.sid',
        cookieSettings,
      )

      res.setHeader(
        'Cache-Control',
        'no-store',
      )

      res.json({
        message:
          'Password reset successfully. Please sign in with your new password.',
      })
    } catch (error) {
      next(error)
    }
  },
)

// ======================================================
// LOGOUT
// ======================================================

authRouter.post(
  '/logout',
  (
    req,
    res,
    next,
  ) => {
    req.session.destroy(
      (error) => {
        if (error) {
          next(error)
          return
        }

        res.clearCookie(
          'purr.sid',
          cookieSettings,
        )

        res.json({
          message:
            'Logged out successfully.',
        })
      },
    )
  },
)
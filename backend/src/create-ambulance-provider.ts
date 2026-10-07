import dotenv from 'dotenv'
import * as argon2 from 'argon2'
import { prisma } from './db.js'

dotenv.config()

async function main() {
  const name = process.env.PROVIDER_SETUP_NAME?.trim() ?? ''
  const email =
    process.env.PROVIDER_SETUP_EMAIL?.trim().toLowerCase() ?? ''
  const password = process.env.PROVIDER_SETUP_PASSWORD ?? ''

  if (name.length < 2 || name.length > 100) {
    throw new Error('Provider name must contain 2–100 characters.')
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('Enter a valid email address.')
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error('Password must contain 12–128 characters.')
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existing) {
    throw new Error(
      'That email already has an account. Use a different email. No existing account was changed.',
    )
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  })

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'AMBULANCE_PROVIDER',
      status: 'ACTIVE',
    },
    select: {
      name: true,
      email: true,
      role: true,
      status: true,
    },
  })

  console.log('Ambulance provider account created:')
  console.log(user)
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Account creation failed.',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
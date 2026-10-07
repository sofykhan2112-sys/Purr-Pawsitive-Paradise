import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name} environment variable`)
  }

  return value
}

const adapter = new PrismaPg({
  connectionString: required('DATABASE_URL'),
  max: 5,
  connectionTimeoutMillis: 5000,
})

export const prisma = new PrismaClient({
  adapter,
})
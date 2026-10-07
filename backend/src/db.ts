import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name} in backend/.env`)
  }

  return value
}

const adapter = new PrismaPg({
  host: required('PGHOST'),
  port: Number(required('PGPORT')),
  database: required('PGDATABASE'),
  user: required('PGUSER'),
  password: required('PGPASSWORD'),
  max: 5,
  connectionTimeoutMillis: 5000,
})

export const prisma = new PrismaClient({ adapter })
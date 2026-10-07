import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

const username = encodeURIComponent(env('PGUSER'))
const password = encodeURIComponent(env('PGPASSWORD'))
const host = env('PGHOST')
const port = env('PGPORT')
const database = encodeURIComponent(env('PGDATABASE'))

const connectionBase =
  `postgresql://${username}:${password}@${host}:${port}`

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    url: `${connectionBase}/${database}`,
    shadowDatabaseUrl: `${connectionBase}/purr_pawsitive_shadow`,
  },
})
export type MaintenanceDatabaseEnvironment = Readonly<
  Record<string, string | undefined>
>

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const LOCAL_PORT = '5432'
const LOCAL_DATABASE = 'purr_pawsitive'

function refuse(reason: string): never {
  throw new Error(`Refusing database maintenance: ${reason}.`)
}

function assertMatchingOptionalTargetSetting(
  environment: MaintenanceDatabaseEnvironment,
  name: 'PGHOST' | 'PGPORT' | 'PGDATABASE',
  matches: (value: string) => boolean,
): void {
  const value = environment[name]

  if (value !== undefined && !matches(value.trim())) {
    refuse(`${name} does not match the required local database target`)
  }
}

/**
 * Allows data-writing maintenance scripts to run only against this project's
 * explicitly configured local PostgreSQL database.
 *
 * Prisma runtime access in db.ts and Prisma CLI access in prisma7.config.ts
 * both use DATABASE_URL. The PGHOST, PGPORT, and PGDATABASE checks prevent
 * conflicting PostgreSQL environment settings from making the target
 * ambiguous, even though this project's Prisma adapter receives DATABASE_URL
 * directly.
 */
export function assertLocalMaintenanceDatabase(
  environment: MaintenanceDatabaseEnvironment = process.env,
): void {
  if (environment.NODE_ENV?.trim().toLowerCase() === 'production') {
    refuse('NODE_ENV is production')
  }

  const databaseUrl = environment.DATABASE_URL

  if (!databaseUrl || databaseUrl !== databaseUrl.trim()) {
    refuse('DATABASE_URL is missing or malformed')
  }

  let target: URL

  try {
    target = new URL(databaseUrl)
  } catch {
    refuse('DATABASE_URL is malformed')
  }

  if (target.protocol !== 'postgresql:') {
    refuse('DATABASE_URL must use PostgreSQL')
  }

  if (!target.username) {
    refuse('DATABASE_URL must include an explicit database user')
  }

  const authorityStart = databaseUrl.indexOf('://') + 3
  const pathStart = databaseUrl.indexOf('/', authorityStart)
  const authority = databaseUrl.slice(authorityStart, pathStart)
  const hostAndPort = authority.slice(authority.lastIndexOf('@') + 1)

  if (
    hostAndPort !== 'localhost:5432' &&
    hostAndPort !== '127.0.0.1:5432'
  ) {
    refuse('DATABASE_URL must explicitly target localhost on port 5432')
  }

  if (
    !LOCAL_HOSTS.has(target.hostname) ||
    target.port !== LOCAL_PORT ||
    target.pathname !== `/${LOCAL_DATABASE}`
  ) {
    refuse('DATABASE_URL does not target the required local database')
  }

  if (target.hash) {
    refuse('DATABASE_URL must not contain a fragment')
  }

  const queryEntries = [...target.searchParams.entries()]
  const hasOnlyPublicSchema =
    queryEntries.length === 0 ||
    (queryEntries.length === 1 &&
      queryEntries[0][0] === 'schema' &&
      queryEntries[0][1] === 'public')

  if (!hasOnlyPublicSchema) {
    refuse('DATABASE_URL contains unsupported connection options')
  }

  assertMatchingOptionalTargetSetting(
    environment,
    'PGHOST',
    (value) => LOCAL_HOSTS.has(value.toLowerCase()),
  )
  assertMatchingOptionalTargetSetting(
    environment,
    'PGPORT',
    (value) => value === LOCAL_PORT,
  )
  assertMatchingOptionalTargetSetting(
    environment,
    'PGDATABASE',
    (value) => value === LOCAL_DATABASE,
  )
}

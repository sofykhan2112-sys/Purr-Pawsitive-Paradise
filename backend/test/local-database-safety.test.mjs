import assert from 'node:assert/strict'
import test from 'node:test'
import { assertLocalMaintenanceDatabase } from '../src/local-database-safety.ts'

const allowedEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL:
    'postgresql://local_user:local_password@127.0.0.1:5432/purr_pawsitive',
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGDATABASE: 'purr_pawsitive',
}

test('allows the two explicit local PostgreSQL targets', () => {
  assert.doesNotThrow(() =>
    assertLocalMaintenanceDatabase(allowedEnvironment),
  )

  assert.doesNotThrow(() =>
    assertLocalMaintenanceDatabase({
      ...allowedEnvironment,
      DATABASE_URL:
        'postgresql://local_user:local_password@localhost:5432/purr_pawsitive?schema=public',
      PGHOST: 'localhost',
    }),
  )
})

test('rejects production and missing or malformed URLs', () => {
  const rejected = [
    { ...allowedEnvironment, NODE_ENV: 'production' },
    { ...allowedEnvironment, DATABASE_URL: undefined },
    { ...allowedEnvironment, DATABASE_URL: 'not a URL' },
    {
      ...allowedEnvironment,
      DATABASE_URL:
        'postgres://local_user:local_password@localhost:5432/purr_pawsitive',
    },
    {
      ...allowedEnvironment,
      DATABASE_URL: 'postgresql://localhost:5432/purr_pawsitive',
    },
  ]

  for (const environment of rejected) {
    assert.throws(() => assertLocalMaintenanceDatabase(environment))
  }
})

test('rejects remote, ambiguous, or unexpected database targets', () => {
  const rejectedUrls = [
    'postgresql://local_user:local_password@database.example.com:5432/purr_pawsitive',
    'postgresql://local_user:local_password@localhost:5433/purr_pawsitive',
    'postgresql://local_user:local_password@localhost:5432/another_database',
    'postgresql://local_user:local_password@localhost/purr_pawsitive',
    'postgresql://local_user:local_password@127.1:5432/purr_pawsitive',
    'postgresql://local_user:local_password@localhost:5432/purr_pawsitive?host=database.example.com',
    'postgresql://local_user:local_password@localhost:5432/purr_pawsitive?schema=private',
    'postgresql://local_user:local_password@localhost:5432/purr_pawsitive#unexpected',
  ]

  for (const databaseUrl of rejectedUrls) {
    assert.throws(() =>
      assertLocalMaintenanceDatabase({
        NODE_ENV: 'development',
        DATABASE_URL: databaseUrl,
      }),
    )
  }
})

test('rejects conflicting PostgreSQL target environment settings', () => {
  for (const override of [
    { PGHOST: 'database.example.com' },
    { PGPORT: '5433' },
    { PGDATABASE: 'another_database' },
  ]) {
    assert.throws(() =>
      assertLocalMaintenanceDatabase({
        ...allowedEnvironment,
        ...override,
      }),
    )
  }
})

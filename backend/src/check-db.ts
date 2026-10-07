import 'dotenv/config'
import pg from 'pg'

async function checkDatabase() {
  const requiredSettings = [
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
  ]

  for (const setting of requiredSettings) {
    if (!process.env[setting]) {
      console.error(`Missing ${setting}. Check backend/.env`)
      process.exitCode = 1
      return
    }
  }

  const client = new pg.Client({
    connectionTimeoutMillis: 5000,
  })

  try {
    await client.connect()

    const result = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS username
    `)

    console.log('Database connected successfully!')
    console.log('Database:', result.rows[0].database)
    console.log('User:', result.rows[0].username)
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : 'UNKNOWN'

    console.error('Database connection failed.')
    console.error('Error code:', code)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void checkDatabase()
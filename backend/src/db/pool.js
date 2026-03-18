import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const { Pool } = pg

const host = process.env.DB_HOST || 'localhost'
const dbSsl = process.env.DB_SSL
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(host)

let useSsl
if (dbSsl === 'true') {
  useSsl = true
} else if (dbSsl === 'false') {
  useSsl = false
} else {
  // Default to no SSL for local PostgreSQL, keep SSL for remote DB unless explicitly overridden.
  useSsl = !isLocalHost
}

const pool = new Pool({
  host,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
})

export default pool

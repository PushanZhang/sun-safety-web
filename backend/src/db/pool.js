import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const { Pool } = pg

const useSsl = process.env.DB_SSL !== 'false'

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
})

export default pool

import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { fileURLToPath } from 'url'

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sqlFilePath = path.resolve(__dirname, '../../sun_safety_db_pg.sql')
const sql = fs.readFileSync(sqlFilePath, 'utf8')

function splitStatements(rawSql) {
  return rawSql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
})

try {
  await client.connect()
  const statements = splitStatements(sql)
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i]
    try {
      await client.query(stmt)
    } catch (error) {
      const preview = stmt.slice(0, 220).replace(/\s+/g, ' ')
      console.error(`Failed statement #${i + 1}: ${preview}...`)
      throw error
    }
  }
  console.log('SQL import completed successfully.')
} catch (error) {
  console.error('SQL import failed:', error.message)
  if (error.detail) console.error('detail:', error.detail)
  if (error.table) console.error('table:', error.table)
  if (error.column) console.error('column:', error.column)
  if (error.where) console.error('where:', error.where)
  process.exitCode = 1
} finally {
  await client.end()
}

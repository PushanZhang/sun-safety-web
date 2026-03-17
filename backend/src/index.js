import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import adminAuthRoutes from './routes/adminAuthRoutes.js'
import alertRoutes from './routes/alertRoutes.js'
import awarenessRoutes from './routes/awarenessRoutes.js'
import clothingRoutes from './routes/clothingRoutes.js'
import pool from './db/pool.js'
import uvRoutes from './routes/uvRoutes.js'
import weatherRoutes from './routes/weatherRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Allow requests from the frontend origin (set CORS_ORIGIN env var in production)
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}
app.use(cors(corsOptions))
app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Sun Safety backend is live',
    health: '/health',
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' })
})

app.use('/api/uv', uvRoutes)
app.use('/api/weather', weatherRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/clothing', clothingRoutes)
app.use('/api/awareness', awarenessRoutes)
app.use('/api/admin', adminAuthRoutes)

async function initializeDatabaseIfEnabled() {
  if (process.env.DB_INIT_ON_START !== 'true') return

  try {
    const sqlPath = path.resolve(process.cwd(), 'sun_safety_db_pg.sql')
    const sql = await fs.readFile(sqlPath, 'utf8')
    await pool.query(sql)
    console.log('Database initialization completed from sun_safety_db_pg.sql')
  } catch (error) {
    console.error('Database initialization failed:', error.message)
  }
}

async function startServer() {
  await initializeDatabaseIfEnabled()
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer()

import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import alertRoutes from './routes/alertRoutes.js'
import uvRoutes from './routes/uvRoutes.js'
import weatherRoutes from './routes/weatherRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' })
})

app.use('/api/uv', uvRoutes)
app.use('/api/weather', weatherRoutes)
app.use('/api/alerts', alertRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

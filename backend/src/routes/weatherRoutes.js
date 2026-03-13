import { Router } from 'express'
import { readCurrentWeather } from '../controllers/weatherController.js'

const router = Router()

router.get('/current', readCurrentWeather)

export default router

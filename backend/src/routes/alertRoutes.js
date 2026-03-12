import { Router } from 'express'
import { readCurrentAlert } from '../controllers/alertController.js'

const router = Router()

router.get('/current', readCurrentAlert)

export default router

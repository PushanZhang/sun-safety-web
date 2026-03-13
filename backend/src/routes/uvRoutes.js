import { Router } from 'express'
import { readCurrentUV } from '../controllers/uvController.js'

const router = Router()

router.get('/current', readCurrentUV)

export default router

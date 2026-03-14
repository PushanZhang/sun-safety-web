import { Router } from 'express'
import { readMonthlyUV } from '../controllers/awarenessController.js'

const router = Router()

router.get('/uv-monthly', readMonthlyUV)

export default router

import { Router } from 'express'
import { readMonthlyUV, readCancerStats } from '../controllers/awarenessController.js'

const router = Router()

router.get('/uv-monthly', readMonthlyUV)
router.get('/cancer-stats', readCancerStats)

export default router

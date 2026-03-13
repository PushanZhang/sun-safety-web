import { Router } from 'express'
import { readClothingRecommendations } from '../controllers/clothingController.js'

const router = Router()

router.get('/current', readClothingRecommendations)

export default router

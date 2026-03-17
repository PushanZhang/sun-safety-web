import { Router } from 'express'
import { getAdminSession, loginAdmin, logoutAdmin } from '../controllers/adminAuthController.js'

const router = Router()

router.post('/login', loginAdmin)
router.get('/me', getAdminSession)
router.post('/logout', logoutAdmin)

export default router

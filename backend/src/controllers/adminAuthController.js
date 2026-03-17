import {
  createAdminSession,
  removeAdminSession,
  verifyAdminSession,
} from '../services/adminAuthService.js'

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) return ''
  return authHeader.slice('Bearer '.length).trim()
}

export function loginAdmin(req, res) {
  const { username = '', password = '' } = req.body || {}
  const session = createAdminSession({ username, password })

  if (!session) {
    res.status(401).json({ message: 'Invalid admin credentials' })
    return
  }

  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      username: session.username,
      role: 'admin',
    },
  })
}

export function getAdminSession(req, res) {
  const token = getBearerToken(req)
  const session = verifyAdminSession(token)

  if (!session) {
    res.status(401).json({ message: 'Not authenticated' })
    return
  }

  res.json({
    user: {
      username: session.username,
      role: 'admin',
    },
    expiresAt: session.expiresAt,
  })
}

export function logoutAdmin(req, res) {
  const token = getBearerToken(req)
  removeAdminSession(token)
  res.json({ success: true })
}

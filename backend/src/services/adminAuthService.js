import crypto from 'crypto'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const sessions = new Map()

function now() {
  return Date.now()
}

function getConfig() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  }
}

export function createAdminSession({ username, password }) {
  const config = getConfig()
  if (username !== config.username || password !== config.password) {
    return null
  }

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = now() + SESSION_TTL_MS
  sessions.set(token, { username: config.username, expiresAt })
  return { token, expiresAt, username: config.username }
}

export function verifyAdminSession(token) {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= now()) {
    sessions.delete(token)
    return null
  }
  return session
}

export function removeAdminSession(token) {
  if (!token) return
  sessions.delete(token)
}

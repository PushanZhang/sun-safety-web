import crypto from 'crypto'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const sessions = new Map()

function now() {
  return Date.now()
}

function readRequiredEnv(name) {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getConfig() {
  return {
    username: readRequiredEnv('ADMIN_USERNAME'),
    password: readRequiredEnv('ADMIN_PASSWORD'),
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

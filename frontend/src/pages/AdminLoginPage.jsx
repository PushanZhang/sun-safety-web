import { useState } from 'react'
import { adminLogin } from '../services/api'

function AdminLoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await adminLogin({ username, password })
      onLoginSuccess(data)
    } catch {
      setError('Login failed. Please check admin username and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-gate">
      <section className="login-card">
        <p className="app-kicker">Sun Safety</p>
        <h1 className="login-title">Admin Access</h1>
        <p className="muted">Enter admin credentials to unlock this website.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="admin-username">
            Username
          </label>
          <input
            id="admin-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="login-input"
            autoComplete="username"
          />

          <label className="login-label" htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="login-input"
            autoComplete="current-password"
          />

          {error ? <p className="error">{error}</p> : null}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Unlock'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AdminLoginPage

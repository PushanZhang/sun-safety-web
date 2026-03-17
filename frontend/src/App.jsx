import { useEffect, useState } from 'react'
import './App.css'
import AwarenessPage from './pages/AwarenessPage'
import AdminLoginPage from './pages/AdminLoginPage'
import HomePage from './pages/HomePage'
import PreventionPage from './pages/PreventionPage'
import { adminLogout, fetchAdminSession } from './services/api'

const ADMIN_TOKEN_KEY = 'sun_safety_admin_token'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

  useEffect(() => {
    if (!adminToken) {
      return
    }

    // Silent session restore: keep UI continuity while validating token in background.
    fetchAdminSession(adminToken)
      .catch(() => {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        setActiveTab('home')
        setAdminToken('')
      })
  }, [adminToken])

  function handleLoginSuccess(payload) {
    if (!payload?.token) return
    localStorage.setItem(ADMIN_TOKEN_KEY, payload.token)
    setAdminToken(payload.token)
  }

  async function handleLogout() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || ''
    if (token) {
      try {
        await adminLogout(token)
      } catch {
        // ignore logout request errors, local session still cleared
      }
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken('')
    setActiveTab('home')
  }

  if (!adminToken) {
    return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">Sun Safety</p>
          <h1 className="app-title">Student UV Assistant</h1>
        </div>
        <nav className="top-nav">
          <button
            className={activeTab === 'home' ? 'active' : ''}
            onClick={() => setActiveTab('home')}
            type="button"
          >
            Home
          </button>
          <button
            className={activeTab === 'awareness' ? 'active' : ''}
            onClick={() => setActiveTab('awareness')}
            type="button"
          >
            Awareness
          </button>
          <button
            className={activeTab === 'prevention' ? 'active' : ''}
            onClick={() => setActiveTab('prevention')}
            type="button"
          >
            Prevention
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      {activeTab === 'home' ? <HomePage /> : null}
      {activeTab === 'awareness' ? <AwarenessPage /> : null}
      {activeTab === 'prevention' ? <PreventionPage /> : null}
    </div>
  )
}

export default App

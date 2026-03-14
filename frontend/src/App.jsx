import { useEffect, useState } from 'react'
import './App.css'
import AwarenessPage from './pages/AwarenessPage'
import HomePage from './pages/HomePage'
import PreventionPage from './pages/PreventionPage'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

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
        </nav>
      </header>

      {activeTab === 'home' ? <HomePage /> : null}
      {activeTab === 'awareness' ? <AwarenessPage /> : null}
      {activeTab === 'prevention' ? <PreventionPage /> : null}
    </div>
  )
}

export default App

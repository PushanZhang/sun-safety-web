import { useEffect, useMemo, useState } from 'react'
import { fetchClothingRecommendations, fetchCurrentUV, fetchCurrentWeather } from '../services/api'
import { getUVLevelInfo } from '../utils/uv'

/* ------------------------------------------------------------------ */
/*  US3.1 helper: sunscreen dosage info based on UV                   */
/* ------------------------------------------------------------------ */
const BODY_PARTS = [
  'Face, neck & ears',
  'Left arm',
  'Right arm',
  'Front torso',
  'Back torso',
  'Left leg',
  'Right leg',
]

function getDosageInfo(uvIndex) {
  if (!Number.isFinite(uvIndex) || uvIndex < 3) return null
  return {
    spf: uvIndex >= 8 ? 'SPF50+' : 'SPF30+',
    totalMl: 35,
    totalTsp: 7,
    note:
      uvIndex >= 8
        ? 'Very high UV — use SPF50+. Reapply every 2 hours and immediately after swimming or sweating.'
        : 'Apply SPF30+ or higher. Reapply every 2 hours and after swimming or sweating.',
  }
}

function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

const FALLBACK_LOCATION = {
  locationName: 'Melbourne',
  latitude: -37.8136,
  longitude: 144.9631,
}

function PreventionPage() {
  const [location, setLocation] = useState(FALLBACK_LOCATION)
  const [uvIndex, setUVIndex] = useState(null)
  const [temperatureC, setTemperatureC] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [category, setCategory] = useState('Low')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reminderActive, setReminderActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(2 * 60 * 60)
  const [reminderDue, setReminderDue] = useState(false)

  useEffect(() => {
    if (!reminderActive) return
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setReminderDue(true)
          setReminderActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [reminderActive])

  function startReminder() {
    setSecondsLeft(2 * 60 * 60)
    setReminderDue(false)
    setReminderActive(true)
  }

  function markReapplied() {
    setSecondsLeft(2 * 60 * 60)
    setReminderDue(false)
    setReminderActive(true)
  }

  const dosageInfo = getDosageInfo(Number.isFinite(uvIndex) ? uvIndex : 0)

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation((current) => ({
          ...current,
          locationName: 'Your current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
      },
      () => {
        setError('Location access is off. Using Melbourne baseline for clothing advice.')
      },
      { timeout: 6000 },
    )
  }, [])

  useEffect(() => {
    let active = true

    async function loadRecommendations() {
      setLoading(true)
      try {
        const [uvRes, weatherRes] = await Promise.all([
          fetchCurrentUV({ latitude: location.latitude, longitude: location.longitude }),
          fetchCurrentWeather({ latitude: location.latitude, longitude: location.longitude }),
        ])

        if (!active) return

        const resolvedUV = uvRes.uvIndex
        const resolvedTemp = weatherRes.temperatureC ?? 20

        setUVIndex(resolvedUV)
        setTemperatureC(resolvedTemp)

        const clothingRes = await fetchClothingRecommendations({
          uvIndex: resolvedUV,
          temperature: resolvedTemp,
        })

        if (!active) return

        setRecommendations(clothingRes.recommendations || [])
        setCategory(clothingRes.category || uvRes.category || 'Low')
        setError('')
      } catch {
        if (!active) return

        const fallbackUV = 8
        const fallbackTemp = 28
        setUVIndex(fallbackUV)
        setTemperatureC(fallbackTemp)
        setCategory('Very High')
        setRecommendations([
          {
            clothing_item: 'Wide-brim hat',
            protection_level: 'High',
            recommendation_text: 'Wear a wide-brim hat that shades your face, neck, and ears.',
          },
          {
            clothing_item: 'Long-sleeve shirt',
            protection_level: 'High',
            recommendation_text: 'Choose lightweight long sleeves with tightly woven fabric.',
          },
          {
            clothing_item: 'UV sunglasses',
            protection_level: 'Medium',
            recommendation_text: 'Use wrap-around sunglasses that block UVA and UVB.',
          },
        ])
        setError('Live data is unavailable. Showing baseline UV clothing guidance.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadRecommendations()

    return () => {
      active = false
    }
  }, [location.latitude, location.longitude])

  const levelInfo = getUVLevelInfo(Number.isFinite(uvIndex) ? uvIndex : 0)
  const lastUpdated = useMemo(() => new Date().toLocaleTimeString(), [uvIndex, temperatureC])

  return (
    <main className="page prevention-page">
      <header className="page-header">
        <div>
          <h2>UV Clothing Planner</h2>
          <div className="secondary-row">
            <p className="muted">Location: {location.locationName}</p>
            <span className="dot-sep" aria-hidden="true">
              •
            </span>
            <p className="meta-time" aria-label="last updated time">
              Updated {lastUpdated}
            </p>
          </div>
        </div>
      </header>

      <section className="page-hero page-hero-prevention">
        <img src="/images/prevention-hero.svg" alt="Sun-safe outfit visual" loading="lazy" />
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="card prevention-overview" aria-live="polite">
        <div className="section-head">
          <p className="section-kicker">Story 3.3</p>
          <h3>Choose what to wear based on UV risk</h3>
        </div>

        <div className="prevention-metrics">
          <article className="metric-pill">
            <p className="tile-label">Current UV</p>
            <p className="tile-value">{loading ? 'Loading...' : Number(uvIndex).toFixed(1)}</p>
            <span className="uv-level" style={{ backgroundColor: levelInfo.color }}>
              {levelInfo.level}
            </span>
          </article>

          <article className="metric-pill">
            <p className="tile-label">Temperature</p>
            <p className="tile-value">{loading ? 'Loading...' : `${Math.round(temperatureC)} deg C`}</p>
            <p className="muted">Used to adjust outfit comfort.</p>
          </article>

          <article className="metric-pill">
            <p className="tile-label">Recommendation Set</p>
            <p className="tile-value">{category}</p>
            <p className="muted">UV category from backend rules.</p>
          </article>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Recommended clothing and accessories</h3>
        </div>

        {loading ? (
          <p className="muted">Loading UV-based clothing guidance...</p>
        ) : (
          <div className="clothing-grid">
            {recommendations.map((rec, index) => (
              <article className="clothing-item" key={`${rec.clothing_item || 'item'}-${index}`}>
                <p className="clothing-title">{rec.clothing_item || 'Protection item'}</p>
                <p className="clothing-level">Protection: {rec.protection_level || 'General'}</p>
                <p className="clothing-text">{rec.recommendation_text}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── US3.1: Sunscreen Dosage Calculator ── */}
      <section className="card">
        <div className="section-head">
          <p className="section-kicker">Story 3.1</p>
          <h3>Sunscreen Dosage Calculator</h3>
        </div>

        {loading ? (
          <p className="muted">Loading dosage recommendation...</p>
        ) : dosageInfo === null ? (
          <p className="muted">
            UV is currently below 3 — sunscreen is not required unless you have very sensitive skin
            or plan extended outdoor time.
          </p>
        ) : (
          <>
            <p className="dosage-summary">
              Use <strong>{dosageInfo.spf}</strong> — approximately{' '}
              <strong>{dosageInfo.totalTsp} tsp ({dosageInfo.totalMl}ml)</strong> for full body
              coverage.
            </p>
            <div className="dosage-grid">
              {BODY_PARTS.map((part) => (
                <div key={part} className="dosage-part">
                  <span className="dosage-part-name">{part}</span>
                  <span className="dosage-part-amount">1 tsp</span>
                </div>
              ))}
            </div>
            <p className="dosage-note muted">{dosageInfo.note}</p>
          </>
        )}
      </section>

      {/* ── US3.2: Sunscreen Reminder Tracker ── */}
      <section className="card reminder-card">
        <div className="section-head">
          <p className="section-kicker">Story 3.2</p>
          <h3>Sunscreen Reminder</h3>
        </div>

        {reminderDue ? (
          <div className="reminder-due">
            <p className="reminder-due-title">⏰ Time to reapply sunscreen!</p>
            <p className="muted">
              Reapply {dosageInfo ? dosageInfo.spf : 'SPF30+'} now, especially if you have been
              swimming, sweating, or towel-drying.
            </p>
            <button className="reminder-btn reminder-btn-confirm" type="button" onClick={markReapplied}>
              ✓ I've reapplied — start next 2-hour timer
            </button>
          </div>
        ) : reminderActive ? (
          <div className="reminder-active">
            <p className="reminder-label">Next reapplication in</p>
            <p className="reminder-countdown" aria-live="polite">
              {formatCountdown(secondsLeft)}
            </p>
            <button
              className="reminder-btn reminder-btn-stop"
              type="button"
              onClick={() => setReminderActive(false)}
            >
              Stop reminder
            </button>
          </div>
        ) : (
          <div className="reminder-idle">
            <p className="muted">
              Track your sunscreen reapplication. Reminder fires every 2 hours — or sooner if you
              swim or sweat.
            </p>
            <button className="reminder-btn reminder-btn-start" type="button" onClick={startReminder}>
              ▶ Start 2-hour reminder
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default PreventionPage

import { useEffect, useMemo, useState } from 'react'
import { fetchClothingRecommendations, fetchCurrentUV, fetchCurrentWeather } from '../services/api'
import { fetchOpenMeteoCurrent } from '../services/openMeteo'
import { getUVLevelInfo } from '../utils/uv'

const SKIN_PROFILES = {
  very_fair: {
    label: 'Very fair / burns very easily',
    recommendedSpf: 'SPF50+',
    reminderMinutes: 90,
    guidance: 'Your skin tends to burn quickly. Prioritize shade and frequent reapplication.',
  },
  fair: {
    label: 'Fair / usually burns first',
    recommendedSpf: 'SPF50+',
    reminderMinutes: 105,
    guidance: 'Use stronger SPF and keep reapplication intervals shorter on sunny days.',
  },
  medium: {
    label: 'Medium / sometimes burns',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'Maintain regular SPF use and reapply every 2 hours in outdoor exposure.',
  },
  olive: {
    label: 'Olive / rarely burns',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'UV still causes long-term damage. Keep sunscreen and protective clothing routine.',
  },
  brown_black: {
    label: 'Brown / dark skin tone',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'Melanin adds some protection, but UV damage still accumulates over time.',
  },
}

function recommendProfileFromQuiz({ burnResponse, tanResponse, freckleResponse }) {
  let score = 0

  if (burnResponse === 'always') score += 3
  if (burnResponse === 'sometimes') score += 2
  if (burnResponse === 'rarely') score += 1

  if (tanResponse === 'never') score += 3
  if (tanResponse === 'light') score += 2
  if (tanResponse === 'easy') score += 1

  if (freckleResponse === 'many') score += 2
  if (freckleResponse === 'some') score += 1

  if (score >= 7) return 'very_fair'
  if (score >= 5) return 'fair'
  if (score >= 3) return 'medium'
  if (score >= 2) return 'olive'
  return 'brown_black'
}

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

function getDosageInfo(uvIndex, skinProfile) {
  if (!Number.isFinite(uvIndex) || uvIndex < 3) return null

  const profile = SKIN_PROFILES[skinProfile] || SKIN_PROFILES.medium
  const baseSpf = uvIndex >= 8 ? 'SPF50+' : 'SPF30+'
  const spf = profile.recommendedSpf === 'SPF50+' ? 'SPF50+' : baseSpf

  return {
    spf,
    totalMl: 35,
    totalTsp: 7,
    reminderMinutes: profile.reminderMinutes,
    profileGuidance: profile.guidance,
    note:
      uvIndex >= 8
        ? `Very high UV — use ${spf}. Reapply every ${profile.reminderMinutes} minutes and immediately after swimming or sweating.`
        : `Apply ${spf} or higher. Reapply every ${profile.reminderMinutes} minutes and after swimming or sweating.`,
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
  const [skinProfile, setSkinProfile] = useState('medium')
  const [quizAnswers, setQuizAnswers] = useState({
    burnResponse: 'sometimes',
    tanResponse: 'easy',
    freckleResponse: 'none',
  })
  const [reminderActive, setReminderActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(2 * 60 * 60)
  const [reminderDue, setReminderDue] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sunSafetySkinProfile')
    if (saved && SKIN_PROFILES[saved]) {
      setSkinProfile(saved)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sunSafetySkinProfile', skinProfile)
  }, [skinProfile])

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
    const minutes = SKIN_PROFILES[skinProfile]?.reminderMinutes || 120
    setSecondsLeft(minutes * 60)
    setReminderDue(false)
    setReminderActive(true)
  }

  function markReapplied() {
    const minutes = SKIN_PROFILES[skinProfile]?.reminderMinutes || 120
    setSecondsLeft(minutes * 60)
    setReminderDue(false)
    setReminderActive(true)
  }

  const dosageInfo = getDosageInfo(Number.isFinite(uvIndex) ? uvIndex : 0, skinProfile)
  const suggestedProfile = recommendProfileFromQuiz(quizAnswers)

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
        let uvRes
        let weatherRes

        try {
          const live = await fetchOpenMeteoCurrent({
            latitude: location.latitude,
            longitude: location.longitude,
          })
          uvRes = live.uv
          weatherRes = live.weather
        } catch {
          ;[uvRes, weatherRes] = await Promise.all([
            fetchCurrentUV({ latitude: location.latitude, longitude: location.longitude }),
            fetchCurrentWeather({ latitude: location.latitude, longitude: location.longitude }),
          ])
        }

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

      <section className="card">
        <div className="section-head">
          <p className="section-kicker">Personalization</p>
          <h3>Set your skin profile</h3>
        </div>
        <label className="reminder-label" htmlFor="skin-profile-select">
          Skin profile
        </label>
        <select
          id="skin-profile-select"
          className="skin-select"
          value={skinProfile}
          onChange={(event) => setSkinProfile(event.target.value)}
        >
          {Object.entries(SKIN_PROFILES).map(([key, profile]) => (
            <option key={key} value={key}>
              {profile.label}
            </option>
          ))}
        </select>
        <p className="muted">{SKIN_PROFILES[skinProfile].guidance}</p>

        <div className="skin-quiz">
          <p className="reminder-label">Quick skin profile quiz</p>

          <label className="quiz-label" htmlFor="burn-response-select">
            1) In strong sun without protection, how quickly do you burn?
          </label>
          <select
            id="burn-response-select"
            className="skin-select"
            value={quizAnswers.burnResponse}
            onChange={(event) =>
              setQuizAnswers((prev) => ({ ...prev, burnResponse: event.target.value }))
            }
          >
            <option value="always">Burns very quickly</option>
            <option value="sometimes">Sometimes burns</option>
            <option value="rarely">Rarely burns</option>
            <option value="never">Almost never burns</option>
          </select>

          <label className="quiz-label" htmlFor="tan-response-select">
            2) After sun exposure, what usually happens?
          </label>
          <select
            id="tan-response-select"
            className="skin-select"
            value={quizAnswers.tanResponse}
            onChange={(event) => setQuizAnswers((prev) => ({ ...prev, tanResponse: event.target.value }))}
          >
            <option value="never">Burns, little or no tan</option>
            <option value="light">Mild tan after some burn</option>
            <option value="easy">Tans easily</option>
          </select>

          <label className="quiz-label" htmlFor="freckle-response-select">
            3) Do you have freckles on sun-exposed areas?
          </label>
          <select
            id="freckle-response-select"
            className="skin-select"
            value={quizAnswers.freckleResponse}
            onChange={(event) =>
              setQuizAnswers((prev) => ({ ...prev, freckleResponse: event.target.value }))
            }
          >
            <option value="many">Many</option>
            <option value="some">Some</option>
            <option value="none">Few or none</option>
          </select>

          <p className="muted">
            Suggested profile: <strong>{SKIN_PROFILES[suggestedProfile].label}</strong>
          </p>
          {suggestedProfile !== skinProfile && (
            <button
              className="reminder-btn reminder-btn-start"
              type="button"
              onClick={() => setSkinProfile(suggestedProfile)}
            >
              Apply suggested profile
            </button>
          )}
        </div>
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
            <p className="muted">Skin-aware sunscreen timing is applied.</p>
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
            <p className="muted">{dosageInfo.profileGuidance}</p>
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
              ✓ I've reapplied — start next {SKIN_PROFILES[skinProfile].reminderMinutes}-min timer
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
              Track your sunscreen reapplication. Current profile reminder interval:{' '}
              <strong>{SKIN_PROFILES[skinProfile].reminderMinutes} minutes</strong>.
            </p>
            <button className="reminder-btn reminder-btn-start" type="button" onClick={startReminder}>
              ▶ Start sunscreen reminder
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default PreventionPage

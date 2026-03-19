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
    sunburnRiskLevel: 'very_high',
    sunburnAdvice: '🚨 CRITICAL: You burn very easily! Apply SPF50+ immediately and reapply every 90 minutes. Seek shade during peak UV hours (10am-4pm).',
  },
  fair: {
    label: 'Fair / usually burns first',
    recommendedSpf: 'SPF50+',
    reminderMinutes: 105,
    guidance: 'Use stronger SPF and keep reapplication intervals shorter on sunny days.',
    sunburnRiskLevel: 'high',
    sunburnAdvice: '⚠ HIGH RISK: You burn easily! Use SPF50+ and reapply every 105 minutes. Wear protective clothing and seek shade when possible.',
  },
  medium: {
    label: 'Medium / sometimes burns',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'Maintain regular SPF use and reapply every 2 hours in outdoor exposure.',
    sunburnRiskLevel: 'moderate',
    sunburnAdvice: '✓ MODERATE RISK: Use SPF30+ and reapply every 2 hours. UV protection is still essential for cumulative damage prevention.',
  },
  olive: {
    label: 'Olive / rarely burns',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'UV still causes long-term damage. Keep sunscreen and protective clothing routine.',
    sunburnRiskLevel: 'low',
    sunburnAdvice: '✓ LOW RISK: While you rarely burn, UV damage still accumulates. Use SPF30+ regularly as part of your routine.',
  },
  brown_black: {
    label: 'Brown / dark skin tone',
    recommendedSpf: 'SPF30+',
    reminderMinutes: 120,
    guidance: 'Melanin adds some protection, but UV damage still accumulates over time.',
    sunburnRiskLevel: 'low',
    sunburnAdvice: '✓ LOW RISK: Melanin provides natural protection, but cumulative UV damage is still a concern. Use SPF30+ regularly.',
  },
}

function recommendProfileFromQuiz({ burnResponse, tanResponse, freckleResponse }) {
  // Weighted Fitzpatrick-like risk score: burn tendency matters most, then tanning, then freckles.
  const burnRisk = { always: 4, sometimes: 3, rarely: 2, never: 1 }
  const tanRisk = { never: 4, light: 3, easy: 2 }
  const freckleRisk = { many: 3, some: 2, none: 1 }

  const burnNorm = ((burnRisk[burnResponse] || 1) - 1) / 3
  const tanNorm = ((tanRisk[tanResponse] || 2) - 1) / 3
  const freckleNorm = ((freckleRisk[freckleResponse] || 1) - 1) / 2

  const riskScore = Math.round((burnNorm * 0.5 + tanNorm * 0.35 + freckleNorm * 0.15) * 100)

  if (riskScore >= 82) return { profile: 'very_fair', riskScore }
  if (riskScore >= 64) return { profile: 'fair', riskScore }
  if (riskScore >= 44) return { profile: 'medium', riskScore }
  if (riskScore >= 20) return { profile: 'olive', riskScore }
  return { profile: 'brown_black', riskScore }
}

// Determine if sunburn risk is HIGH (based on UV + skin profile)
function isHighSunburnRisk(uvIndex, skinProfile) {
  if (!SKIN_PROFILES[skinProfile]) return false
  const profile = SKIN_PROFILES[skinProfile]
  const isHighRiskProfile = ['very_fair', 'fair'].includes(skinProfile)
  const isHighUV = uvIndex >= 6
  return isHighRiskProfile || isHighUV
}

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

const BODY_PARTS = [
  'Face, neck & ears',
  'Left arm',
  'Right arm',
  'Front torso',
  'Back torso',
  'Left leg',
  'Right leg',
]

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
  const [quizCompleted, setQuizCompleted] = useState(true)
  const [reminderActive, setReminderActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [reminderDue, setReminderDue] = useState(false)
  const [showReminderNotification, setShowReminderNotification] = useState(false)
  const [showGoodJobPopup, setShowGoodJobPopup] = useState(false)

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
          setShowReminderNotification(true)
          setReminderActive(false)
          // Show browser notification if available
          if (document.hidden && Notification.permission === 'granted') {
            new Notification('☀️ Sunscreen Reminder', {
              body: 'Time to reapply sunscreen!',
              icon: '/images/notification-icon.png',
            })
          }
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
    setShowReminderNotification(false)
    setReminderActive(true)
  }

  function markReapplied() {
    setShowReminderNotification(false)
    startReminder()
  }

  const dosageInfo = getDosageInfo(Number.isFinite(uvIndex) ? uvIndex : 0, skinProfile)
  const quizSuggestion = recommendProfileFromQuiz(quizAnswers)
  const suggestedProfile = quizSuggestion.profile
  const highSunburnRisk = isHighSunburnRisk(Number.isFinite(uvIndex) ? uvIndex : 0, skinProfile)

  // Auto-suggest reminder for high-risk profiles
  useEffect(() => {
    if (highSunburnRisk && !reminderActive && dosageInfo && !reminderDue) {
      // Optionally auto-start reminder for very high risk
      if (skinProfile === 'very_fair' && !reminderActive) {
        // Could auto-start, but let user initiate manually
      }
    }
  }, [highSunburnRisk, skinProfile, dosageInfo, reminderActive, reminderDue])

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        let locationName = 'Your current location'
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const data = await res.json()
          const addr = data.address || {}
          locationName =
            addr.suburb ||
            addr.neighbourhood ||
            addr.town ||
            addr.village ||
            addr.city ||
            addr.county ||
            'Your current location'
        } catch {
          // geocoding failed — keep generic label
        }
        setLocation((current) => ({
          ...current,
          locationName,
          latitude,
          longitude,
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
          <h2>UV Protection Planner</h2>
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

      {/* ─── REMINDER NOTIFICATION POPUP ─── */}
      {showReminderNotification && (
        <div className="reminder-notification-overlay" role="alertdialog" aria-modal="true">
          <div className="reminder-notification-popup">
            <p className="notification-title">⏰ Time to Reapply Sunscreen!</p>
            <p className="notification-message">
              It's been {SKIN_PROFILES[skinProfile]?.reminderMinutes || 120} minutes since your last application.
              Please reapply {dosageInfo && dosageInfo.spf} now, especially if you've been swimming, sweating,
              or towel-drying.
            </p>
            <div className="notification-actions">
              <button
                className="reminder-btn reminder-btn-confirm"
                type="button"
                onClick={markReapplied}
              >
                ✓ I've Reapplied
              </button>
              <button
                className="reminder-btn reminder-btn-secondary"
                type="button"
                onClick={() => setShowReminderNotification(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Good Job Popup */}
      {showGoodJobPopup && (
        <div className="good-job-overlay" role="alertdialog" aria-modal="true">
          <div className="good-job-popup">
            <p className="good-job-emoji">✨</p>
            <p className="good-job-text">Good job!</p>
            <p className="good-job-subtext">You're protecting your skin!</p>
          </div>
        </div>
      )}

      {/* ─── STEP 1: CURRENT UV & CLOTHING RECOMMENDATIONS ─── */}
      <section className="card prevention-step step-current-conditions">
        <div className="section-head">
          <p className="section-kicker">Step 1</p>
          <h3>Current UV Risk & Recommended Outfit</h3>
        </div>

        {loading ? (
          <p className="muted">Loading UV and clothing data...</p>
        ) : (
          <>
            <div className="current-conditions-row">
              <article className="condition-metric">
                <p className="metric-label">UV Index</p>
                <div className="metric-display">
                  <span className="metric-value">{Number(uvIndex).toFixed(1)}</span>
                  <span className="uv-level" style={{ backgroundColor: levelInfo.color }}>
                    {levelInfo.level}
                  </span>
                </div>
              </article>

              <article className="condition-metric">
                <p className="metric-label">Temperature</p>
                <div className="metric-display">
                  <span className="metric-value">{Math.round(temperatureC)}°C</span>
                  <p className="metric-note muted">For outfit comfort</p>
                </div>
              </article>

              <article className="condition-metric">
                <p className="metric-label">Category</p>
                <div className="metric-display">
                  <span className="metric-value">{category}</span>
                  <p className="metric-note muted">Recommendation set</p>
                </div>
              </article>
            </div>

            <div className="recommendations-section">
              <h4 className="subsection-title">What to Wear Today:</h4>
              <div className="clothing-grid">
                {recommendations && recommendations.map((rec, index) => (
                  <article className="clothing-card" key={`${rec.clothing_item || 'item'}-${index}`}>
                    <p className="clothing-title">{rec.clothing_item || 'Protection item'}</p>
                    <p className="clothing-level-badge">{rec.protection_level || 'General'}</p>
                    <p className="clothing-text">{rec.recommendation_text}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {error && (
        <div className="error-banner" role="status">
          <p>{error}</p>
        </div>
      )}

      {/* ─── STEP 2: PERSONALIZED SKIN PROFILE QUIZ ─── */}
      <section className="card prevention-step step-skin-profile">
        <div className="section-head">
          <p className="section-kicker">Step 2</p>
          <h3>Tell Us About Your Skin</h3>
          <p className="section-subtitle">Answer these quick questions to get personalized sun protection advice</p>
        </div>

        <div className="skin-profile-section">
          <div className="quiz-container">
            <div className="quiz-question">
              <label htmlFor="burn-q" className="quiz-label">
                1. In strong sun without protection, how quickly do you burn?
              </label>
              <select
                id="burn-q"
                className="skin-select"
                value={quizAnswers.burnResponse}
                onChange={(event) => {
                  setQuizAnswers((prev) => ({ ...prev, burnResponse: event.target.value }))
                  setQuizCompleted(true)
                }}
              >
                <option value="always">Burns very quickly</option>
                <option value="sometimes">Sometimes burns</option>
                <option value="rarely">Rarely burns</option>
                <option value="never">Almost never burns</option>
              </select>
            </div>

            <div className="quiz-question">
              <label htmlFor="tan-q" className="quiz-label">
                2. After sun exposure, what usually happens?
              </label>
              <select
                id="tan-q"
                className="skin-select"
                value={quizAnswers.tanResponse}
                onChange={(event) => {
                  setQuizAnswers((prev) => ({ ...prev, tanResponse: event.target.value }))
                  setQuizCompleted(true)
                }}
              >
                <option value="never">Burns, little or no tan</option>
                <option value="light">Mild tan after some burn</option>
                <option value="easy">Tans easily</option>
              </select>
            </div>

            <div className="quiz-question">
              <label htmlFor="freckle-q" className="quiz-label">
                3. Do you have freckles on sun-exposed areas?
              </label>
              <select
                id="freckle-q"
                className="skin-select"
                value={quizAnswers.freckleResponse}
                onChange={(event) => {
                  setQuizAnswers((prev) => ({ ...prev, freckleResponse: event.target.value }))
                  setQuizCompleted(true)
                }}
              >
                <option value="many">Many</option>
                <option value="some">Some</option>
                <option value="none">Few or none</option>
              </select>
            </div>
          </div>

          {quizCompleted && (
            <div className="quiz-suggestion-box">
              <p className="suggestion-label">Your Suggested Skin Type:</p>
              <p className="suggestion-profile">
                <strong>{SKIN_PROFILES[suggestedProfile].label}</strong> (Risk Score: {quizSuggestion.riskScore}/100)
              </p>
              {suggestedProfile !== skinProfile ? (
                <button
                  className="reminder-btn reminder-btn-apply"
                  type="button"
                  onClick={() => setSkinProfile(suggestedProfile)}
                >
                  Apply This Profile
                </button>
              ) : (
                <p className="profile-applied-badge">
                  ✓ Profile Applied
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── STEP 3: PERSONALIZED SUN PROTECTION ADVICE ─── */}
      <section className="card prevention-step step-sun-protection-advice">
        <div className="section-head">
          <p className="section-kicker">Step 3</p>
          <h3>Your Personal Sun Protection Plan</h3>
        </div>

        {quizCompleted ? (
          suggestedProfile === skinProfile ? (
            <div className="protection-advice-container">
              {/* Sun illustration */}
              <svg className="step-decoration sun-icon" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                {/* Sun rays */}
                <g stroke="#FFB300" strokeWidth="4" strokeLinecap="round">
                  <line x1="60" y1="10" x2="60" y2="25" />
                  <line x1="60" y1="95" x2="60" y2="110" />
                  <line x1="10" y1="60" x2="25" y2="60" />
                  <line x1="95" y1="60" x2="110" y2="60" />
                  <line x1="22" y1="22" x2="33" y2="33" />
                  <line x1="87" y1="87" x2="98" y2="98" />
                  <line x1="98" y1="22" x2="87" y2="33" />
                  <line x1="33" y1="87" x2="22" y2="98" />
                </g>
                {/* Sun circle */}
                <circle cx="60" cy="60" r="38" fill="#FFC107" opacity="0.9" />
                <circle cx="60" cy="60" r="38" fill="none" stroke="#FFB300" strokeWidth="2" opacity="0.5" />
                {/* Sun gradient effect */}
                <circle cx="55" cy="55" r="28" fill="#FFD54F" opacity="0.6" />
              </svg>

              <div className={`advice-card advice-${SKIN_PROFILES[skinProfile].sunburnRiskLevel}`}>
                <p className="advice-text">{SKIN_PROFILES[skinProfile].sunburnAdvice}</p>
              </div>

              <div className="selected-profile-details">
                <p className="profile-name">{SKIN_PROFILES[skinProfile].label}</p>
                <p className="profile-guidance">{SKIN_PROFILES[skinProfile].guidance}</p>
                <p className="reminder-interval">
                  Recommended reapplication interval: <strong>{SKIN_PROFILES[skinProfile].reminderMinutes} minutes</strong>
                </p>
              </div>

              {/* HIGH SUNBURN RISK ALERT */}
              {highSunburnRisk && (
                <div className="high-risk-alert-banner">
                  <p className="alert-icon">🚨</p>
                  <div className="alert-content">
                    <p className="alert-title">High Sunburn Risk Detected</p>
                    <p className="alert-message">
                      Your skin type combined with current UV levels puts you at increased risk. Apply sunscreen
                      immediately and use the reminder timer below to stay on top of reapplication.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="muted">Apply the suggested profile above to see your personalized sun protection advice.</p>
          )
        ) : (
          <p className="muted">Complete the quiz above to see your personalized sun protection advice.</p>
        )}
      </section>

      {/* ─── STEP 4: SUNSCREEN DOSAGE CALCULATOR ─── */}
      {dosageInfo && (
        <section className="card prevention-step step-dosage">
          <div className="section-head">
            <p className="section-kicker">Dosage</p>
            <h3>Sunscreen Application Guide</h3>
          </div>

          {/* Sunscreen bottle illustration */}
          <svg className="step-decoration sunscreen-bottle" viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">
            {/* Pump top */}
            <rect x="32" y="8" width="36" height="12" rx="3" fill="#E8E8E8" stroke="#999" strokeWidth="1.5" />
            <rect x="40" y="4" width="20" height="8" rx="2" fill="#D0D0D0" stroke="#999" strokeWidth="1" />
            {/* Pump nozzle */}
            <circle cx="50" cy="3" r="3" fill="#A0A0A0" />
            
            {/* Main bottle body */}
            <path d="M 30 20 L 25 40 Q 20 80 25 120 Q 28 145 50 150 Q 72 145 75 120 Q 80 80 75 40 L 70 20 Z" 
                  fill="#FFE082" stroke="#FBC02D" strokeWidth="2" opacity="0.95" />
            
            {/* Bottle shine effect */}
            <ellipse cx="40" cy="60" rx="8" ry="30" fill="#FFFFFF" opacity="0.4" />
            
            {/* SPF label background */}
            <rect x="28" y="70" width="44" height="30" rx="4" fill="#FFFFFF" opacity="0.8" stroke="#FBC02D" strokeWidth="1" />
            
            {/* SPF text */}
            <text x="50" y="82" fontSize="14" fontWeight="bold" fill="#FF6F00" textAnchor="middle">SPF</text>
            <text x="50" y="96" fontSize="12" fontWeight="bold" fill="#FF6F00" textAnchor="middle">50+</text>
          </svg>

          <div className="dosage-summary-card">
            <p className="dosage-main">
              Use <strong>{dosageInfo.spf}</strong> — approximately{' '}
              <strong>{dosageInfo.totalTsp} teaspoons ({dosageInfo.totalMl}ml)</strong> for full body coverage.
            </p>
            <p className="dosage-note muted">{dosageInfo.note}</p>
          </div>

          <div className="dosage-breakdown">
            <h4 className="subsection-title">Application by Body Part:</h4>
            <div className="dosage-grid">
              {BODY_PARTS.map((part) => (
                <div key={part} className="dosage-part">
                  <span className="dosage-part-name">{part}</span>
                  <span className="dosage-part-amount">1 tsp</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── STEP 5: SUNSCREEN REMINDER & TIMER ─── */}
      <section className="card prevention-step step-reminder reminder-card">
        <div className="section-head">
          <p className="section-kicker">Reminder</p>
          <h3>Sunscreen Reapplication Timer</h3>
        </div>

        {reminderDue ? (
          <div className="reminder-state reminder-due">
            <p className="reminder-state-title">⏰ Reapplication Due Now!</p>
            <p className="reminder-state-message">
              It's time to reapply {dosageInfo ? dosageInfo.spf : 'SPF30+'}, especially if you've been swimming,
              sweating, or towel-drying your skin.
            </p>
            <button className="reminder-btn reminder-btn-confirm" type="button" onClick={markReapplied}>
              ✓ I've Reapplied — Start Next Timer
            </button>
          </div>
        ) : reminderActive ? (
          <div className="reminder-state reminder-active">
            <p className="reminder-state-label">Next Reapplication In:</p>
            <p className="reminder-countdown" aria-live="polite">
              {formatCountdown(secondsLeft)}
            </p>
            <p className="reminder-profile-note">
              Profile interval: {SKIN_PROFILES[skinProfile].reminderMinutes} minutes
            </p>

            {/* Timer Decoration SVG */}
            <svg className="timer-decoration" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
              {/* Clock circle */}
              <circle cx="60" cy="60" r="50" fill="#E3F2FD" stroke="#1976D2" strokeWidth="2.5" />
              {/* Clock tick marks */}
              <g stroke="#1976D2" strokeWidth="1.5">
                <line x1="60" y1="12" x2="60" y2="20" />
                <line x1="60" y1="100" x2="60" y2="108" />
                <line x1="12" y1="60" x2="20" y2="60" />
                <line x1="100" y1="60" x2="108" y2="60" />
              </g>
              {/* Center dot */}
              <circle cx="60" cy="60" r="3.5" fill="#1976D2" />
              {/* Hour hand */}
              <line x1="60" y1="60" x2="60" y2="35" stroke="#1976D2" strokeWidth="3" strokeLinecap="round" />
              {/* Minute hand */}
              <line x1="60" y1="60" x2="80" y2="60" stroke="#42A5F5" strokeWidth="2.5" strokeLinecap="round" />
              {/* Second hand (animated) */}
              <line x1="60" y1="60" x2="60" y2="25" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            </svg>

            <button 
              className="reminder-btn reminder-btn-stop" 
              type="button" 
              onClick={() => {
                setReminderActive(false)
                setShowGoodJobPopup(true)
                setTimeout(() => setShowGoodJobPopup(false), 2000)
              }}
            >
              ✓ I've Applied Sunscreen
            </button>
          </div>
        ) : (
          <div className="reminder-state reminder-idle">
            <p className="reminder-idle-text">
              Keep track of your sunscreen reapplication with this timer. Your current profile recommends
              reapplication every <strong>{SKIN_PROFILES[skinProfile].reminderMinutes} minutes</strong>.
            </p>
            <button className="reminder-btn reminder-btn-start" type="button" onClick={startReminder}>
              ▶ Start Sunscreen Timer
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default PreventionPage

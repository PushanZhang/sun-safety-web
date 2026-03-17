import { useEffect, useMemo, useState } from 'react'
import AlertBanner from '../components/AlertBanner'
import UVCard from '../components/UVCard'
import WeatherCard from '../components/WeatherCard'
import { fetchClothingRecommendations, fetchCurrentAlerts, fetchCurrentUV, fetchCurrentWeather } from '../services/api'
import { fetchOpenMeteoCurrent } from '../services/openMeteo'

const FALLBACK_LOCATION = {
  locationName: 'Melbourne',
  latitude: -37.8136,
  longitude: 144.9631,
}

function HomePage() {
  const [location, setLocation] = useState(FALLBACK_LOCATION)
  const [uvData, setUvData] = useState(null)
  const [uvIndex, setUVIndex] = useState(null)
  const [weather, setWeather] = useState(null)
  const [alert, setAlert] = useState(null)
  const [loadingUV, setLoadingUV] = useState(true)
  const [loadingWeather, setLoadingWeather] = useState(true)
  const [clothingRecs, setClothingRecs] = useState([])
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

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
        setError('Location access is off. Showing Melbourne baseline data.')
      },
      { timeout: 6000 },
    )
  }, [])

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoadingUV(true)
      setLoadingWeather(true)
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

        setUvData(uvRes)
        setUVIndex(uvRes.uvIndex)
        setWeather(weatherRes)

        try {
          const alertRes = await fetchCurrentAlerts({ uvIndex: uvRes.uvIndex })
          if (!active) return
          setAlert(alertRes)
        } catch {
          if (active) {
            setAlert({
              title: 'UV advisory',
              message: 'Alert service is temporarily unavailable.',
              severity: 'medium',
            })
          }
        }

        try {
          const clothingRes = await fetchClothingRecommendations({
            uvIndex: uvRes.uvIndex,
            temperature: weatherRes.temperatureC ?? 20,
          })
          if (!active) return
          setClothingRecs(clothingRes.recommendations || [])
        } catch {
          if (active) {
            setClothingRecs([
              { recommendation_text: 'Use SPF30+ or above before going outdoors.' },
              { recommendation_text: 'Wear a hat and sunglasses for midday exposure.' },
              { recommendation_text: 'Plan shade breaks when UV is high or very high.' },
            ])
          }
        }
      } catch {
        if (active) {
          setError('Live data is temporarily unavailable. Showing baseline values.')
          setUvData({ source: 'fallback', observedAt: new Date().toISOString() })
          setUVIndex(8)
          setWeather({ temperatureC: 28, condition: 'Sunny', humidityPct: 48 })
          setAlert({
            title: 'High UV conditions',
            message: 'UV is high today. Wear SPF50+, hat and sunglasses.',
            severity: 'high',
          })
          setClothingRecs([
            { recommendation_text: 'Use SPF30+ or above before going outdoors.' },
            { recommendation_text: 'Wear a hat and sunglasses for midday exposure.' },
            { recommendation_text: 'Plan shade breaks when UV is high or very high.' }
          ])
        }
      } finally {
        if (active) {
          setLoadingUV(false)
          setLoadingWeather(false)
        }
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [location.latitude, location.longitude, refreshTick])

  const lastUpdated = useMemo(() => new Date().toLocaleTimeString(), [uvIndex, weather])

  return (
    <main className="page home-page">
      <header className="page-header">
        <div>
          <h2>Today at a glance</h2>
          <div className="secondary-row">
            <p className="muted">Location: {location.locationName}</p>
            <span className="dot-sep" aria-hidden="true">
              •
            </span>
            <p className="meta-time" aria-label="last updated time">
              Updated {lastUpdated}
            </p>
            <button
              type="button"
              className="refresh-btn"
              onClick={() => setRefreshTick((value) => value + 1)}
            >
              Refresh Live Data
            </button>
          </div>
        </div>
      </header>

      <section className="page-hero page-hero-home">
        <img src="/images/home-hero.svg" alt="Sun and city visual for live UV tracking" loading="lazy" />
      </section>

      {error ? <p className="error">{error}</p> : null}

      <AlertBanner alert={alert} />

      <div className="grid home-grid">
        <UVCard
          locationName={location.locationName}
          uvIndex={uvIndex}
          loading={loadingUV}
          source={uvData?.source}
          observedAt={uvData?.observedAt}
        />
        <WeatherCard weather={weather || {}} loading={loadingWeather} />
      </div>

      <section className="card next-steps">
        <h3>Quick protection checklist</h3>
        {clothingRecs.length > 0 ? (
          <ul className="compact-list">
            {clothingRecs.map((rec, index) => (
              <li key={index}>{rec.recommendation_text}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Loading recommendations...</p>
        )}
      </section>
    </main>
  )
}

export default HomePage

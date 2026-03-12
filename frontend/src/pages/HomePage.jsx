import { useEffect, useMemo, useState } from 'react'
import AlertBanner from '../components/AlertBanner'
import UVCard from '../components/UVCard'
import WeatherCard from '../components/WeatherCard'
import { fetchCurrentAlerts, fetchCurrentUV, fetchCurrentWeather } from '../services/api'

const FALLBACK_LOCATION = {
  locationName: 'Melbourne',
  latitude: -37.8136,
  longitude: 144.9631,
}

function HomePage() {
  const [location, setLocation] = useState(FALLBACK_LOCATION)
  const [uvIndex, setUVIndex] = useState(null)
  const [weather, setWeather] = useState(null)
  const [alert, setAlert] = useState(null)
  const [loadingUV, setLoadingUV] = useState(true)
  const [loadingWeather, setLoadingWeather] = useState(true)
  const [error, setError] = useState('')

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
        const [uvRes, weatherRes] = await Promise.all([
          fetchCurrentUV({ latitude: location.latitude, longitude: location.longitude }),
          fetchCurrentWeather({ latitude: location.latitude, longitude: location.longitude }),
        ])

        if (!active) return

        setUVIndex(uvRes.uvIndex)
        setWeather(weatherRes)

        const alertRes = await fetchCurrentAlerts({ uvIndex: uvRes.uvIndex })
        if (!active) return
        setAlert(alertRes)
      } catch {
        if (active) {
          setError('Live data is temporarily unavailable. Showing baseline values.')
          setUVIndex(8)
          setWeather({ temperatureC: 28, condition: 'Sunny', humidityPct: 48 })
          setAlert({
            title: 'High UV conditions',
            message: 'UV is high today. Wear SPF50+, hat and sunglasses.',
          })
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
  }, [location.latitude, location.longitude])

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
          </div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <AlertBanner alert={alert} />

      <div className="grid home-grid">
        <UVCard locationName={location.locationName} uvIndex={uvIndex} loading={loadingUV} />
        <WeatherCard weather={weather || {}} loading={loadingWeather} />
      </div>

      <section className="card next-steps">
        <h3>Quick protection checklist</h3>
        <ul className="compact-list">
          <li>Use SPF30+ or above before going outdoors.</li>
          <li>Wear a hat and sunglasses for midday exposure.</li>
          <li>Plan shade breaks when UV is high or very high.</li>
        </ul>
      </section>
    </main>
  )
}

export default HomePage

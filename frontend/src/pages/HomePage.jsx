import { useEffect, useMemo, useRef, useState } from 'react'
import AlertBanner from '../components/AlertBanner'
import UVCard from '../components/UVCard'
import WeatherCard from '../components/WeatherCard'
import { fetchClothingRecommendations, fetchCurrentAlerts, fetchCurrentUV, fetchCurrentWeather } from '../services/api'
import { fetchOpenMeteoCurrent } from '../services/openMeteo'
import { getUVLevelInfo } from '../utils/uv'

const FALLBACK_LOCATION = {
  locationName: 'Melbourne',
  latitude: -37.8136,
  longitude: 144.9631,
}

const CITIES = [
  { name: 'Sydney',      latitude: -33.8688, longitude: 151.2093 },
  { name: 'Melbourne',   latitude: -37.8136, longitude: 144.9631 },
  { name: 'Brisbane',    latitude: -27.4698, longitude: 153.0251 },
  { name: 'Perth',       latitude: -31.9505, longitude: 115.8605 },
  { name: 'Adelaide',    latitude: -34.9285, longitude: 138.6007 },
  { name: 'Gold Coast',  latitude: -28.0167, longitude: 153.4000 },
  { name: 'Canberra',    latitude: -35.2809, longitude: 149.1300 },
  { name: 'Hobart',      latitude: -42.8821, longitude: 147.3272 },
  { name: 'Darwin',      latitude: -12.4634, longitude: 130.8456 },
]

function HomePage({ onNavigate }) {
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

  const [citiesOpen, setCitiesOpen] = useState(false)
  const [hoveredCity, setHoveredCity] = useState(null)
  const [cityDataCache, setCityDataCache] = useState({})
  const [cityLoadingMap, setCityLoadingMap] = useState({})
  const citySelectorRef = useRef(null)

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

  // Close city dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (citySelectorRef.current && !citySelectorRef.current.contains(e.target)) {
        setCitiesOpen(false)
        setHoveredCity(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleCityHover(city) {
    setHoveredCity(city)
    if (cityDataCache[city.name] !== undefined) return // already cached (even if null)
    setCityLoadingMap((prev) => ({ ...prev, [city.name]: true }))
    try {
      const live = await fetchOpenMeteoCurrent({ latitude: city.latitude, longitude: city.longitude })
      setCityDataCache((prev) => ({ ...prev, [city.name]: live }))
    } catch {
      setCityDataCache((prev) => ({ ...prev, [city.name]: null }))
    } finally {
      setCityLoadingMap((prev) => ({ ...prev, [city.name]: false }))
    }
  }

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

            {/* City selector */}
            <div className="city-selector" ref={citySelectorRef}>
              <button
                type="button"
                className="refresh-btn city-selector-btn"
                onClick={() => setCitiesOpen((v) => !v)}
              >
                Australian Cities {citiesOpen ? '▲' : '▼'}
              </button>

              {citiesOpen && (
                <div className="city-dropdown">
                  {CITIES.map((city) => {
                    const data = cityDataCache[city.name]
                    const isLoading = cityLoadingMap[city.name]
                    const isHovered = hoveredCity?.name === city.name
                    const uv = data?.uv
                    const wx = data?.weather
                    const uvInfo = uv ? getUVLevelInfo(uv.uvIndex) : null

                    return (
                      <div
                        key={city.name}
                        className="city-dropdown-item"
                        onMouseEnter={() => handleCityHover(city)}
                        onMouseLeave={() => setHoveredCity(null)}
                      >
                        <span className="city-dropdown-name">{city.name}</span>
                        {uv && (
                          <span
                            className="city-dropdown-badge"
                            style={{ background: uvInfo.color }}
                          >
                            UV {uv.uvIndex.toFixed(1)}
                          </span>
                        )}

                        {/* Floating preview panel */}
                        {isHovered && (
                          <div className="city-float-panel">
                            <p className="city-float-title">{city.name}</p>
                            {isLoading && <p className="city-float-loading">Loading...</p>}
                            {!isLoading && !data && (
                              <p className="city-float-loading">Data unavailable</p>
                            )}
                            {!isLoading && uv && wx && (
                              <div className="city-float-metrics">
                                <div className="city-float-row">
                                  <span className="city-float-label">UV Index</span>
                                  <span
                                    className="city-float-value city-float-uv"
                                    style={{ background: uvInfo.color }}
                                  >
                                    {uv.uvIndex.toFixed(1)} · {uvInfo.level}
                                  </span>
                                </div>
                                <div className="city-float-row">
                                  <span className="city-float-label">Temperature</span>
                                  <span className="city-float-value">{wx.temperatureC}°C</span>
                                </div>
                                <div className="city-float-row">
                                  <span className="city-float-label">Condition</span>
                                  <span className="city-float-value">{wx.condition}</span>
                                </div>
                                {wx.humidityPct != null && (
                                  <div className="city-float-row">
                                    <span className="city-float-label">Humidity</span>
                                    <span className="city-float-value">{wx.humidityPct}%</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
          onNavigate={onNavigate}
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

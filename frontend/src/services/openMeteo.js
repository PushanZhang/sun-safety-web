function mapWeatherCode(code) {
  const value = Number(code)
  if (value === 0) return 'Clear'
  if ([1, 2].includes(value)) return 'Partly Cloudy'
  if (value === 3) return 'Overcast'
  if ([45, 48].includes(value)) return 'Fog'
  if ([51, 53, 55, 56, 57].includes(value)) return 'Drizzle'
  if ([61, 63, 65, 66, 67].includes(value)) return 'Rain'
  if ([71, 73, 75, 77].includes(value)) return 'Snow'
  if ([80, 81, 82].includes(value)) return 'Rain Showers'
  if ([85, 86].includes(value)) return 'Snow Showers'
  if ([95, 96, 99].includes(value)) return 'Thunderstorm'
  return 'Unknown'
}

function uvCategory(uvIndex) {
  if (uvIndex <= 2) return 'Low'
  if (uvIndex <= 5) return 'Moderate'
  if (uvIndex <= 7) return 'High'
  if (uvIndex <= 10) return 'Very High'
  return 'Extreme'
}

export async function fetchOpenMeteoCurrent({ latitude, longitude }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,cloud_cover,uv_index',
  )
  url.searchParams.set('timezone', 'auto')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`)
  }

  const payload = await response.json()
  if (!payload?.current) {
    throw new Error('Open-Meteo current data unavailable')
  }

  const current = payload.current
  const uvIndex = Number(current.uv_index ?? 0)

  return {
    uv: {
      locationName: 'Current location',
      latitude,
      longitude,
      uvIndex,
      category: uvCategory(uvIndex),
      observedAt: current.time ?? new Date().toISOString(),
      source: 'open-meteo-live',
    },
    weather: {
      latitude,
      longitude,
      temperatureC: Number(current.temperature_2m ?? 0),
      condition: mapWeatherCode(current.weather_code),
      feelsLike: current.apparent_temperature ?? null,
      cloudCover: current.cloud_cover ?? null,
      humidityPct: current.relative_humidity_2m ?? null,
      observedAt: current.time ?? new Date().toISOString(),
      source: 'open-meteo-live',
    },
  }
}

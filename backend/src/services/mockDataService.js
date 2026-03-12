function uvCategory(uvIndex) {
  if (uvIndex <= 2) return 'LOW'
  if (uvIndex <= 5) return 'MODERATE'
  if (uvIndex <= 7) return 'HIGH'
  if (uvIndex <= 10) return 'VERY_HIGH'
  return 'EXTREME'
}

export function getCurrentUV({ lat, lon }) {
  const baseline = 6 + ((Number(lat) || 0) % 2)
  const uvIndex = Number((baseline + Math.abs((Number(lon) || 0) % 1)).toFixed(1))

  return {
    locationName: 'Current location',
    latitude: Number(lat) || -37.8136,
    longitude: Number(lon) || 144.9631,
    uvIndex,
    category: uvCategory(uvIndex),
    observedAt: new Date().toISOString(),
    source: 'mock',
  }
}

export function getCurrentWeather({ lat, lon }) {
  return {
    latitude: Number(lat) || -37.8136,
    longitude: Number(lon) || 144.9631,
    temperatureC: 27,
    humidityPct: 48,
    condition: 'Sunny',
    observedAt: new Date().toISOString(),
    source: 'mock',
  }
}

export function getCurrentAlert({ uv }) {
  const uvValue = Number(uv)
  if (!Number.isFinite(uvValue)) {
    return {
      title: 'No UV data',
      message: 'UV data is not ready yet. Please check again shortly.',
      severity: 'info',
      source: 'mock',
    }
  }

  if (uvValue >= 8) {
    return {
      title: 'Very high UV warning',
      message: 'Avoid prolonged sun exposure. Use SPF50+, hat, sunglasses, and shade.',
      severity: 'high',
      source: 'mock',
    }
  }

  if (uvValue >= 6) {
    return {
      title: 'High UV advisory',
      message: 'Use sunscreen and protective clothing when outdoors.',
      severity: 'medium',
      source: 'mock',
    }
  }

  return {
    title: 'Low to moderate UV',
    message: 'Basic sun protection is still recommended.',
    severity: 'low',
    source: 'mock',
  }
}

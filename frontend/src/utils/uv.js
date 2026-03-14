export function getUVLevelInfo(uvIndex) {
  if (uvIndex <= 2) return { level: 'Low', color: '#2e7d32' }
  if (uvIndex <= 5) return { level: 'Moderate', color: '#f9a825' }
  if (uvIndex <= 7) return { level: 'High', color: '#ef6c00' }
  if (uvIndex <= 10) return { level: 'Very High', color: '#c62828' }
  return { level: 'Extreme', color: '#6a1b9a' }
}

export function getUVMessage(uvIndex) {
  if (uvIndex <= 2) return 'Low UV. Sunglasses are still recommended outdoors.'
  if (uvIndex <= 5) return 'Moderate UV. Use SPF30+ sunscreen when outside.'
  if (uvIndex <= 7)
    return 'High UV. Skin can burn quickly. Hat, sunglasses, and shade are recommended.'
  if (uvIndex <= 10)
    return 'Very high UV. Skin can burn within about 15-25 minutes without protection.'
  return 'Extreme UV. Minimize direct sun exposure and use full sun protection.'
}

/**
 * Returns approximate minutes before unprotected fair skin (Type II) begins to burn.
 * Returns null for UV < 3 (no significant burn risk).
 */
export function getBurnTimeMinutes(uvIndex) {
  if (!Number.isFinite(uvIndex) || uvIndex < 3) return null
  const raw = Math.round(200 / uvIndex)
  const rounded = Math.round(raw / 5) * 5
  return Math.max(10, Math.min(60, rounded))
}

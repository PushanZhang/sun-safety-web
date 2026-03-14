const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}

export function fetchCurrentUV({ latitude, longitude }) {
  return request(`/api/uv/current?lat=${latitude}&lon=${longitude}`)
}

export function fetchCurrentWeather({ latitude, longitude }) {
  return request(`/api/weather/current?lat=${latitude}&lon=${longitude}`)
}

export function fetchCurrentAlerts({ uvIndex }) {
  return request(`/api/alerts/current?uv=${uvIndex}`)
}

export function fetchClothingRecommendations({ uvIndex, temperature }) {
  return request(`/api/clothing/current?uv=${uvIndex}&temp=${temperature}`)
}

export function fetchUVMonthly() {
  return request('/api/awareness/uv-monthly')
}

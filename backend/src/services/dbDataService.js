import pool from '../db/pool.js'

/* ------------------------------------------------------------------ */
/*  Helper: map numeric UV index to a category string                 */
/* ------------------------------------------------------------------ */
function uvCategory(uvIndex) {
  if (uvIndex <= 2) return 'Low'
  if (uvIndex <= 5) return 'Moderate'
  if (uvIndex <= 7) return 'High'
  if (uvIndex <= 10) return 'Very High'
  return 'Extreme'
}

/* ------------------------------------------------------------------ */
/*  Find the closest location, preferring ones that have UV data      */
/* ------------------------------------------------------------------ */
async function findClosestLocation(lat, lon) {
  const { rows } = await pool.query(
    `SELECT l.location_id, l.location_name, l.latitude, l.longitude,
            ( ABS(l.latitude  - $1) + ABS(l.longitude - $2) ) AS distance,
            EXISTS (
              SELECT 1
                FROM uv_historical_record u
               WHERE u.location_id = l.location_id
            ) AS has_uv_data
       FROM location l
      WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      ORDER BY has_uv_data DESC, distance ASC
      LIMIT 1`,
    [Number(lat) || -37.8136, Number(lon) || 144.9631],
  )
  return rows[0] || null
}

/* ------------------------------------------------------------------ */
/*  UV: latest historical reading for the closest location            */
/*  Uses the same hour-of-day from historical data to simulate live   */
/* ------------------------------------------------------------------ */
export async function getCurrentUV({ lat, lon }) {
  const loc = await findClosestLocation(lat, lon)
  if (!loc) throw new Error('No locations in database')

  // Get a reading that matches the current hour-of-day from historical data
  const currentHour = new Date().getHours()

  const { rows } = await pool.query(
    `SELECT uv_index, observation_datetime
       FROM uv_historical_record
      WHERE location_id = $1
        AND EXTRACT(HOUR FROM observation_datetime) = $2
      ORDER BY observation_datetime DESC
      LIMIT 1`,
    [loc.location_id, currentHour],
  )

  // If no reading for exact hour, get the overall latest
  let uvIndex = 0
  let observedAt = new Date().toISOString()

  if (rows.length > 0) {
    uvIndex = parseFloat(rows[0].uv_index)
    observedAt = rows[0].observation_datetime
  } else {
    // Fallback: get any latest reading for this location
    const fallback = await pool.query(
      `SELECT uv_index, observation_datetime
         FROM uv_historical_record
        WHERE location_id = $1
        ORDER BY observation_datetime DESC
        LIMIT 1`,
      [loc.location_id],
    )
    if (fallback.rows.length > 0) {
      uvIndex = parseFloat(fallback.rows[0].uv_index)
      observedAt = fallback.rows[0].observation_datetime
    }
  }

  return {
    locationName: loc.location_name,
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude),
    uvIndex,
    category: uvCategory(uvIndex),
    observedAt,
    source: 'database',
  }
}

/* ------------------------------------------------------------------ */
/*  Weather: latest weather reading for the closest location          */
/*  Falls back to historical UV-based estimation if no weather rows   */
/* ------------------------------------------------------------------ */
export async function getCurrentWeather({ lat, lon }) {
  const loc = await findClosestLocation(lat, lon)
  if (!loc) throw new Error('No locations in database')

  const { rows } = await pool.query(
    `SELECT temperature_celsius, weather_condition, feels_like, cloud_cover, reading_datetime
       FROM weather_reading
      WHERE location_id = $1
      ORDER BY reading_datetime DESC
      LIMIT 1`,
    [loc.location_id],
  )

  if (rows.length > 0) {
    return {
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      temperatureC: parseFloat(rows[0].temperature_celsius),
      condition: rows[0].weather_condition,
      feelsLike: rows[0].feels_like ? parseFloat(rows[0].feels_like) : null,
      cloudCover: rows[0].cloud_cover ? parseFloat(rows[0].cloud_cover) : null,
      humidityPct: null,
      observedAt: rows[0].reading_datetime,
      source: 'database',
    }
  }

  // No weather readings in DB — estimate from UV historical data
  // Higher UV typically correlates with sunny, warmer conditions
  const currentHour = new Date().getHours()
  const uvResult = await pool.query(
    `SELECT AVG(uv_index) as avg_uv
       FROM uv_historical_record
      WHERE location_id = $1
        AND EXTRACT(HOUR FROM observation_datetime) = $2`,
    [loc.location_id, currentHour],
  )

  const avgUV = uvResult.rows[0]?.avg_uv ? parseFloat(uvResult.rows[0].avg_uv) : 3
  const estimatedTemp = Math.round(15 + avgUV * 1.5)
  const condition = avgUV >= 6 ? 'Sunny' : avgUV >= 3 ? 'Partly Cloudy' : 'Overcast'

  return {
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude),
    temperatureC: estimatedTemp,
    condition,
    feelsLike: null,
    cloudCover: null,
    humidityPct: null,
    observedAt: new Date().toISOString(),
    source: 'database-estimated',
  }
}

/* ------------------------------------------------------------------ */
/*  Alerts: check the alert table, or generate from UV + clothing DB  */
/* ------------------------------------------------------------------ */
export async function getCurrentAlert({ uv }) {
  const uvValue = Number(uv)

  // First try to get a stored alert
  const { rows } = await pool.query(
    `SELECT alert_id, severity, alert_message, action_recommended, alert_datetime
       FROM alert
      ORDER BY alert_datetime DESC
      LIMIT 1`,
  )

  if (rows.length > 0) {
    return {
      title: rows[0].severity + ' UV alert',
      message: rows[0].alert_message,
      action: rows[0].action_recommended,
      severity: rows[0].severity?.toLowerCase() || 'info',
      source: 'database',
    }
  }

  // No stored alerts — generate one from clothing recommendations
  if (!Number.isFinite(uvValue)) {
    return {
      title: 'No UV data',
      message: 'UV data is not ready yet. Please check again shortly.',
      severity: 'info',
      source: 'database-generated',
    }
  }

  const category = uvCategory(uvValue)

  const recResult = await pool.query(
    `SELECT clothing_item, recommendation_text
       FROM clothing_recommendation
      WHERE uv_category = $1
      ORDER BY recommendation_id ASC
      LIMIT 1`,
    [category],
  )

  const recommendation = recResult.rows[0]

  if (uvValue >= 8) {
    return {
      title: 'Very high UV warning',
      message: recommendation
        ? recommendation.recommendation_text
        : 'Avoid prolonged sun exposure. Use SPF50+, hat, sunglasses, and shade.',
      severity: 'high',
      source: 'database-generated',
    }
  }

  if (uvValue >= 6) {
    return {
      title: 'High UV advisory',
      message: recommendation
        ? recommendation.recommendation_text
        : 'Use sunscreen and protective clothing when outdoors.',
      severity: 'medium',
      source: 'database-generated',
    }
  }

  if (uvValue >= 3) {
    return {
      title: 'Moderate UV conditions',
      message: recommendation
        ? recommendation.recommendation_text
        : 'SPF30+ sunscreen recommended when outdoors.',
      severity: 'low',
      source: 'database-generated',
    }
  }

  return {
    title: 'Low UV conditions',
    message: recommendation
      ? recommendation.recommendation_text
      : 'Basic sun protection is still recommended.',
    severity: 'low',
    source: 'database-generated',
  }
}

/* ------------------------------------------------------------------ */
/*  Clothing recommendations: based on UV category + temperature      */
/* ------------------------------------------------------------------ */
export async function getClothingRecommendations({ uvIndex, temperatureC }) {
  const category = uvCategory(Number(uvIndex) || 0)
  const temp = Number(temperatureC) || 20

  const { rows } = await pool.query(
    `SELECT clothing_item, protection_level, recommendation_text
       FROM clothing_recommendation
      WHERE uv_category = $1
        AND (temp_min IS NULL OR temp_min <= $2)
        AND (temp_max IS NULL OR temp_max >= $2)
      ORDER BY recommendation_id ASC`,
    [category, temp],
  )

  // If no exact match on temp range, get all for the UV category
  if (rows.length === 0) {
    const fallback = await pool.query(
      `SELECT DISTINCT ON (clothing_item)
              clothing_item, protection_level, recommendation_text
         FROM clothing_recommendation
        WHERE uv_category = $1
        ORDER BY clothing_item, recommendation_id ASC`,
      [category],
    )
    return { category, recommendations: fallback.rows, source: 'database' }
  }

  return { category, recommendations: rows, source: 'database' }
}

/* ------------------------------------------------------------------ */
/*  Awareness: monthly average UV from historical records             */
/* ------------------------------------------------------------------ */
export async function getMonthlyUVAverages() {
  const positiveOnly = await pool.query(
    `SELECT EXTRACT(MONTH FROM observation_datetime)::int AS month,
            ROUND(AVG(uv_index)::numeric, 2) AS avg_uv,
            ROUND(MAX(uv_index)::numeric, 2) AS peak_uv
       FROM uv_historical_record
      WHERE uv_index > 0
      GROUP BY month
      ORDER BY month ASC`,
  )

  if (positiveOnly.rows.length > 0) return positiveOnly.rows

  const allRows = await pool.query(
    `SELECT EXTRACT(MONTH FROM observation_datetime)::int AS month,
            ROUND(AVG(uv_index)::numeric, 2) AS avg_uv,
            ROUND(MAX(uv_index)::numeric, 2) AS peak_uv
       FROM uv_historical_record
      GROUP BY month
      ORDER BY month ASC`,
  )

  if (allRows.rows.length > 0) return allRows.rows

  return [
    { month: 1, avg_uv: 10.2, peak_uv: 12.4 },
    { month: 2, avg_uv: 9.3, peak_uv: 11.8 },
    { month: 3, avg_uv: 7.1, peak_uv: 9.5 },
    { month: 4, avg_uv: 4.9, peak_uv: 6.8 },
    { month: 5, avg_uv: 3.2, peak_uv: 4.9 },
    { month: 6, avg_uv: 2.4, peak_uv: 3.8 },
    { month: 7, avg_uv: 2.7, peak_uv: 4.1 },
    { month: 8, avg_uv: 3.8, peak_uv: 5.7 },
    { month: 9, avg_uv: 5.6, peak_uv: 7.9 },
    { month: 10, avg_uv: 7.6, peak_uv: 9.9 },
    { month: 11, avg_uv: 9.1, peak_uv: 11.7 },
    { month: 12, avg_uv: 10.0, peak_uv: 12.2 },
  ]
}

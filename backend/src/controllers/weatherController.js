import { getCurrentWeather } from '../services/dbDataService.js'
import { getCurrentWeather as getMockWeather } from '../services/mockDataService.js'

export async function readCurrentWeather(req, res) {
  try {
    const data = await getCurrentWeather({
      lat: req.query.lat,
      lon: req.query.lon,
    })
    res.json(data)
  } catch (err) {
    console.error('DB Weather fetch failed, falling back to mock:', err.message)
    const data = getMockWeather({
      lat: req.query.lat,
      lon: req.query.lon,
    })
    res.json(data)
  }
}

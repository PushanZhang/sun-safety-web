import { getCurrentWeather } from '../services/mockDataService.js'

export function readCurrentWeather(req, res) {
  const data = getCurrentWeather({
    lat: req.query.lat,
    lon: req.query.lon,
  })

  res.json(data)
}

import { getCurrentUV } from '../services/mockDataService.js'

export function readCurrentUV(req, res) {
  const data = getCurrentUV({
    lat: req.query.lat,
    lon: req.query.lon,
  })

  res.json(data)
}

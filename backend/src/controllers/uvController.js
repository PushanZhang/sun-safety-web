import { getCurrentUV } from '../services/dbDataService.js'
import { getLiveUV } from '../services/liveDataService.js'
import { getCurrentUV as getMockUV } from '../services/mockDataService.js'

export async function readCurrentUV(req, res) {
  try {
    const data = await getLiveUV({
      lat: req.query.lat,
      lon: req.query.lon,
    })
    res.json(data)
    return
  } catch (liveErr) {
    console.error('Live UV fetch failed, trying database:', liveErr.message)
  }

  try {
    const data = await getCurrentUV({
      lat: req.query.lat,
      lon: req.query.lon,
    })
    res.json(data)
  } catch (err) {
    console.error('DB UV fetch failed, falling back to mock:', err.message)
    const data = getMockUV({
      lat: req.query.lat,
      lon: req.query.lon,
    })
    res.json(data)
  }
}

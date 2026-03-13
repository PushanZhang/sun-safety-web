import { getClothingRecommendations } from '../services/dbDataService.js'

export async function readClothingRecommendations(req, res) {
  try {
    const data = await getClothingRecommendations({
      uvIndex: req.query.uv,
      temperatureC: req.query.temp,
    })
    res.json(data)
  } catch (err) {
    console.error('DB Clothing fetch failed:', err.message)
    res.status(500).json({ error: 'Failed to fetch clothing recommendations' })
  }
}

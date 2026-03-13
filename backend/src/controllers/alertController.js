import { getCurrentAlert } from '../services/dbDataService.js'
import { getCurrentAlert as getMockAlert } from '../services/mockDataService.js'

export async function readCurrentAlert(req, res) {
  try {
    const data = await getCurrentAlert({ uv: req.query.uv })
    res.json(data)
  } catch (err) {
    console.error('DB Alert fetch failed, falling back to mock:', err.message)
    const data = getMockAlert({ uv: req.query.uv })
    res.json(data)
  }
}

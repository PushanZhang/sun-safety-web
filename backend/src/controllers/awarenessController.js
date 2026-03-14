import { getMonthlyUVAverages } from '../services/dbDataService.js'

export async function readMonthlyUV(req, res) {
  try {
    const data = await getMonthlyUVAverages()
    res.json(data)
  } catch (err) {
    console.error('Monthly UV fetch failed:', err.message)
    res.status(500).json({ error: 'Failed to fetch monthly UV averages' })
  }
}

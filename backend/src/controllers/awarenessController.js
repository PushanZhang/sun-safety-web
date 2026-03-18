import { getMonthlyUVAverages, getMelanomaCases } from '../services/dbDataService.js'

export async function readMonthlyUV(req, res) {
  try {
    const data = await getMonthlyUVAverages()
    res.json(data)
  } catch (err) {
    console.error('Monthly UV fetch failed:', err.message)
    res.status(500).json({ error: 'Failed to fetch monthly UV averages' })
  }
}

export async function readCancerStats(req, res) {
  try {
    const data = await getMelanomaCases()
    res.json(data)
  } catch (err) {
    console.error('Cancer stats fetch failed:', err.message)
    res.status(500).json({ error: 'Failed to fetch cancer statistics' })
  }
}

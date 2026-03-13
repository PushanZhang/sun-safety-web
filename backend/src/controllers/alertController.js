import { getCurrentAlert } from '../services/mockDataService.js'

export function readCurrentAlert(req, res) {
  const data = getCurrentAlert({ uv: req.query.uv })
  res.json(data)
}

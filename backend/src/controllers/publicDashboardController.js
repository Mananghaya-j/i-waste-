import { publicDashboardStats } from '../services/publicDashboardService.js'

export async function stats(req, res) {
  res.json({ data: await publicDashboardStats() })
}

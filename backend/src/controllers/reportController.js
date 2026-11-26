import { exportReport as exportReportData, monthlyVolumeReport } from '../services/reportService.js'

export async function exportReport(req, res) {
  const { type, format, from, to, month, truckId, household } = req.query
  const content = await exportReportData(type, format, { from, to }, req, { month, truckId, household })
  const contentTypes = {
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
  }
  res.setHeader('Content-Type', contentTypes[format])
  res.setHeader('Content-Disposition', `attachment; filename="iwaste-${type}-${new Date().toISOString().slice(0, 10)}.${format}"`)
  res.send(content)
}

export async function volumes(req, res) {
  res.json({ data: await monthlyVolumeReport(req.query) })
}

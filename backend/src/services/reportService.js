import { prisma } from '../database/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { AppError } from '../utils/errors.js'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const reportQueries = {
  pickup: (where) => prisma.pickupRequest.findMany({
    where, take: 5000, orderBy: { createdAt: 'desc' },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } },
  }),
  land: (where) => prisma.treeRequest.findMany({
    where, take: 5000, orderBy: { createdAt: 'desc' },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } },
  }),
  water: (where) => prisma.waterwayRequest.findMany({
    where, take: 5000, orderBy: { createdAt: 'desc' },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } },
  }),
  environmental: (where) => prisma.environmentalReport.findMany({
    where, take: 5000, orderBy: { createdAt: 'desc' },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } },
  }),
  trips: (where) => prisma.tripTicket.findMany({
    where, take: 5000, orderBy: { startedAt: 'desc' },
    include: { truck: { select: { truckId: true, plateNumber: true } }, route: { select: { name: true } }, checkpoints: true },
  }),
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return { gte: start, lt: end }
}

function kilograms(value) {
  return Number(value || 0)
}

export function summarizeJunkshopReports(reports) {
  const materials = new Map()
  const householdWeights = new Map()
  const truckWeights = new Map()
  let totalWeightKg = 0
  let totalVolumeM3 = 0

  for (const report of reports) {
    for (const entry of report.materials) {
      const weightKg = kilograms(entry.weightKg)
      const volumeM3 = Number(entry.volumeM3 || 0)
      const materialName = entry.category === 'OTHER' ? entry.otherMaterial : entry.category
      const key = [report.junkshopId, entry.category, materialName, entry.unit, entry.otherUnit || ''].join(':')
      const row = materials.get(key) || {
        junkshopName: report.junkshop.name,
        accreditationNumber: report.junkshop.accreditationNumber,
        category: entry.category,
        materialName,
        quantity: 0,
        unit: entry.unit,
        otherUnit: entry.otherUnit,
        weightKg: 0,
        volumeM3: 0,
      }
      row.quantity += Number(entry.quantity)
      row.weightKg += weightKg
      row.volumeM3 += volumeM3
      materials.set(key, row)
      totalWeightKg += weightKg
      totalVolumeM3 += volumeM3
      if (report.householdAddress) {
        householdWeights.set(report.householdAddress, (householdWeights.get(report.householdAddress) || 0) + weightKg)
      }
      if (report.truckId) {
        truckWeights.set(report.truckId, (truckWeights.get(report.truckId) || 0) + weightKg)
      }
    }
  }

  return {
    totalWeightKg,
    totalVolumeM3,
    materials: [...materials.values()],
    householdWeights,
    truckWeights,
  }
}

export function calculateLandfillKg(totalWasteKg, recyclablesKg) {
  const difference = Number(totalWasteKg) - Number(recyclablesKg)
  return {
    landfillKg: Math.max(0, difference),
    reconciliationExcessKg: Math.max(0, -difference),
  }
}

export async function monthlyVolumeReport({ month, truckId, household }) {
  const completedAt = monthBounds(month)
  const pickupWhere = {
    status: 'COMPLETED',
    completedAt,
    measuredWasteKg: { not: null },
    ...(truckId ? { assignedTruckId: truckId } : {}),
    ...(household ? { address: { contains: household, mode: 'insensitive' } } : {}),
  }
  const recyclablesWhere = {
    status: 'COMPLETED',
    completedAt,
    actualCollectedKg: { not: null },
    ...(truckId ? { assignedTruckId: truckId } : {}),
    ...(household ? { pickupAddress: { contains: household, mode: 'insensitive' } } : {}),
  }
  const [householdGroups, truckGroups, pickupTotals, recyclableTotal, recyclablesByHousehold, recyclablesByTruck, junkshopReports] = await Promise.all([
    prisma.pickupRequest.groupBy({
      by: ['address'],
      where: pickupWhere,
      _sum: { measuredWasteKg: true, measuredRecyclablesKg: true, measuredCompostKg: true },
      orderBy: { address: 'asc' },
    }),
    prisma.pickupRequest.groupBy({
      by: ['assignedTruckId'],
      where: { ...pickupWhere, assignedTruckId: truckId || { not: null } },
      _sum: { measuredWasteKg: true, measuredRecyclablesKg: true, measuredCompostKg: true },
    }),
    prisma.pickupRequest.aggregate({
      where: pickupWhere,
      _sum: { measuredWasteKg: true, measuredRecyclablesKg: true, measuredCompostKg: true },
    }),
    prisma.recyclablesRequest.aggregate({ where: recyclablesWhere, _sum: { actualCollectedKg: true } }),
    prisma.recyclablesRequest.groupBy({
      by: ['pickupAddress'],
      where: recyclablesWhere,
      _sum: { actualCollectedKg: true },
      orderBy: { pickupAddress: 'asc' },
    }),
    prisma.recyclablesRequest.groupBy({
      by: ['assignedTruckId'],
      where: { ...recyclablesWhere, assignedTruckId: truckId || { not: null } },
      _sum: { actualCollectedKg: true },
    }),
    prisma.junkshopMonthlyReport.findMany({
      where: {
        reportMonth: completedAt,
        ...(truckId ? { truckId } : {}),
        ...(household ? { householdAddress: { contains: household, mode: 'insensitive' } } : {}),
      },
      include: {
        junkshop: { select: { name: true, accreditationNumber: true } },
        materials: true,
      },
    }),
  ])
  const junkshopSummary = summarizeJunkshopReports(junkshopReports)
  const truckIds = [...new Set([
    ...truckGroups.map(({ assignedTruckId }) => assignedTruckId),
    ...recyclablesByTruck.map(({ assignedTruckId }) => assignedTruckId),
    ...junkshopSummary.truckWeights.keys(),
  ].filter(Boolean))]
  const truckRecords = await prisma.truck.findMany({
    where: { id: { in: truckIds } },
    select: { id: true, truckId: true, plateNumber: true },
  })
  const truckNames = new Map(truckRecords.map((truck) => [truck.id, truck]))
  const householdVolumes = new Map(householdGroups.map(({ address, _sum }) => [address, {
    address,
    totalWasteKg: kilograms(_sum.measuredWasteKg),
    recyclablesKg: kilograms(_sum.measuredRecyclablesKg),
    compostingKg: kilograms(_sum.measuredCompostKg),
  }]))
  for (const { pickupAddress, _sum } of recyclablesByHousehold) {
    const householdVolume = householdVolumes.get(pickupAddress) || {
      address: pickupAddress, totalWasteKg: 0, recyclablesKg: 0, compostingKg: 0,
    }
    const weight = kilograms(_sum.actualCollectedKg)
    householdVolume.totalWasteKg += weight
    householdVolume.recyclablesKg += weight
    householdVolumes.set(pickupAddress, householdVolume)
  }
  const truckVolumes = new Map(truckGroups.map(({ assignedTruckId, _sum }) => [assignedTruckId, {
    ...(truckNames.get(assignedTruckId) || { id: assignedTruckId, truckId: 'Unknown', plateNumber: '' }),
    totalWasteKg: kilograms(_sum.measuredWasteKg),
    recyclablesKg: kilograms(_sum.measuredRecyclablesKg),
    compostingKg: kilograms(_sum.measuredCompostKg),
  }]))
  for (const { assignedTruckId, _sum } of recyclablesByTruck) {
    const truckVolume = truckVolumes.get(assignedTruckId) || {
      ...(truckNames.get(assignedTruckId) || { id: assignedTruckId, truckId: 'Unknown', plateNumber: '' }),
      totalWasteKg: 0, recyclablesKg: 0, compostingKg: 0,
    }
    const weight = kilograms(_sum.actualCollectedKg)
    truckVolume.totalWasteKg += weight
    truckVolume.recyclablesKg += weight
    truckVolumes.set(assignedTruckId, truckVolume)
  }
  for (const [address, weight] of junkshopSummary.householdWeights) {
    const householdVolume = householdVolumes.get(address) || {
      address, totalWasteKg: 0, recyclablesKg: 0, compostingKg: 0,
    }
    householdVolume.recyclablesKg += weight
    householdVolumes.set(address, householdVolume)
  }
  for (const [assignedTruckId, weight] of junkshopSummary.truckWeights) {
    const truckVolume = truckVolumes.get(assignedTruckId) || {
      ...(truckNames.get(assignedTruckId) || { id: assignedTruckId, truckId: 'Unknown', plateNumber: '' }),
      totalWasteKg: 0, recyclablesKg: 0, compostingKg: 0,
    }
    truckVolume.recyclablesKg += weight
    truckVolumes.set(assignedTruckId, truckVolume)
  }
  const households = [...householdVolumes.values()].map((row) => ({
    ...row,
    ...calculateLandfillKg(row.totalWasteKg, row.recyclablesKg),
  }))
  const trucks = [...truckVolumes.values()].map((row) => ({
    ...row,
    ...calculateLandfillKg(row.totalWasteKg, row.recyclablesKg),
  }))
  const junkshopRecyclablesKg = junkshopSummary.totalWeightKg
  const totalWasteKg = kilograms(pickupTotals._sum.measuredWasteKg)
    + kilograms(recyclableTotal._sum.actualCollectedKg)
  const recyclablesKg = kilograms(pickupTotals._sum.measuredRecyclablesKg)
    + kilograms(recyclableTotal._sum.actualCollectedKg)
    + junkshopRecyclablesKg
  const landfill = calculateLandfillKg(totalWasteKg, recyclablesKg)
  return {
    month,
    filters: { truckId: truckId || null, household: household || null },
    summary: {
      totalWasteKg,
      recyclablesKg,
      compostingKg: kilograms(pickupTotals._sum.measuredCompostKg),
      ...landfill,
      junkshopRecyclablesKg,
      junkshopRecyclablesM3: junkshopSummary.totalVolumeM3,
    },
    households,
    trucks,
    junkshopMaterials: junkshopSummary.materials,
  }
}

function volumeReportRows(report) {
  const summary = report.summary
  return [
    { recordType: 'MONTHLY SUMMARY', month: report.month, ...summary },
    ...report.households.map((row) => ({ recordType: 'HOUSEHOLD', month: report.month, ...row })),
    ...report.trucks.map((row) => ({
      recordType: 'TRUCK',
      month: report.month,
      truckId: row.truckId,
      plateNumber: row.plateNumber,
      totalWasteKg: row.totalWasteKg,
      recyclablesKg: row.recyclablesKg,
      compostingKg: row.compostingKg,
      landfillKg: row.landfillKg,
    })),
    ...report.junkshopMaterials.map((row) => ({
      recordType: 'JUNKSHOP MATERIAL',
      month: report.month,
      ...row,
    })),
  ]
}

function scalar(value) {
  if (value instanceof Date) return value.toISOString()
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function safeCell(value) {
  let text = scalar(value)
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return text
}

function columnsFor(data) {
  return data.length
    ? [...new Set(data.flatMap((record) => Object.keys(record)))]
      .filter((key) => !['requesterId', 'passwordHash', 'qrCodeValue'].includes(key))
    : []
}

export function renderCsv(data, columns) {
  if (!data.length) return 'No records\n'
  const rows = [columns.map((key) => `"${key}"`).join(',')]
  for (const record of data) {
    rows.push(columns.map((key) => `"${safeCell(record[key]).replaceAll('"', '""')}"`).join(','))
  }
  return `${rows.join('\r\n')}\r\n`
}

export async function renderXlsx(data, columns, type) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'i-WASTE'
  const sheet = workbook.addWorksheet(type.slice(0, 31))
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 2, 14), 36) }))
  sheet.addRows(data.map((record) => Object.fromEntries(columns.map((key) => [key, safeCell(record[key])]))))
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.getRow(1).font = { bold: true }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function renderPdf(data, columns, type) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 40, bufferPages: false })
    const chunks = []
    document.on('data', (chunk) => chunks.push(chunk))
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
    document.fontSize(16).text(`i-WASTE ${type} report`, { align: 'left' })
    document.fontSize(8).text(`Generated ${new Date().toISOString()} | ${data.length} records`, { align: 'left' })
    document.moveDown()
    if (!data.length) document.fontSize(10).text('No records')
    for (const record of data) {
      const line = columns.map((key) => `${key}: ${safeCell(record[key])}`).join(' | ')
      document.fontSize(7).text(line, { width: 515, lineGap: 2 })
      document.moveDown(0.35)
    }
    document.end()
  })
}

export async function exportReport(type, format, range, req, filters = {}) {
  if (type === 'volumes') {
    const report = await monthlyVolumeReport(filters)
    const rows = volumeReportRows(report)
    const columns = columnsFor(rows)
    const content = format === 'xlsx' ? await renderXlsx(rows, columns, type)
      : format === 'pdf' ? await renderPdf(rows, columns, type)
        : Buffer.from(renderCsv(rows, columns), 'utf8')
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, req, {
        action: 'REPORT_EXPORTED',
        entityType: 'Report',
        metadata: { type, format, rowCount: rows.length, month: filters.month },
      })
    })
    return content
  }
  const query = reportQueries[type]
  if (!query) throw new AppError(400, 'Unsupported report type.', 'INVALID_REPORT_TYPE')
  const dateField = type === 'trips' ? 'startedAt' : 'createdAt'
  const where = range.from || range.to ? {
    [dateField]: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  } : {}
  const rows = await query(where)
  const columns = columnsFor(rows)
  const content = format === 'xlsx' ? await renderXlsx(rows, columns, type)
    : format === 'pdf' ? await renderPdf(rows, columns, type)
      : Buffer.from(renderCsv(rows, columns), 'utf8')
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, req, {
      action: 'REPORT_EXPORTED', entityType: 'Report', metadata: { type, format, rowCount: rows.length },
    })
  })
  return content
}

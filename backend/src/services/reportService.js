import { prisma } from '../config/prisma.js'
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
    ? Object.keys(data[0]).filter((key) => !['requesterId', 'passwordHash', 'qrCodeValue'].includes(key))
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

export async function exportReport(type, format, range, req) {
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

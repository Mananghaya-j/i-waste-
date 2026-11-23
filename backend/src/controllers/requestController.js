import { AppError } from '../utils/errors.js'
import * as requestService from '../services/requestService.js'

const collectFiles = (files = {}) => Object.values(files).flat()

function requireFile(req, field) {
  if (!req.files?.[field]?.length) throw new AppError(400, `${field} attachment is required.`, 'ATTACHMENT_REQUIRED')
}

export async function create(kind, req, res) {
  if (kind === 'tree') requireFile(req, 'photo')
  if (kind === 'waterway') requireFile(req, 'photo')
  const record = await requestService.createRequest(kind, req.body, req, collectFiles(req.files))
  res.status(201).json({ data: record })
}

export async function list(kind, req, res) {
  res.json(await requestService.listRequests(kind, req))
}

export async function track(kind, req, res) {
  res.json({ data: await requestService.trackRequest(kind, req.params.referenceNo) })
}

export async function updateStatus(kind, req, res) {
  if (req.body.status === 'COMPLETED' && ['tree', 'waterway'].includes(kind) &&
    !req.files?.proofOfCompletion?.length) {
    throw new AppError(400, 'Proof of completion is required to complete this request.', 'ATTACHMENT_REQUIRED')
  }
  res.json({
    data: await requestService.updateRequestStatus(kind, req.params.id, req.body, req, collectFiles(req.files)),
  })
}

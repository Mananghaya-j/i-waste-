import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const backendRoot = fileURLToPath(new URL('../../', import.meta.url))
export const uploadDirectory = path.resolve(backendRoot, env.UPLOAD_DIR)

export async function persistFiles(files = []) {
  await mkdir(uploadDirectory, { recursive: true })
  const persisted = []
  try {
    for (const file of files) {
      const extension = file.mimetype === 'image/jpeg' ? '.jpg'
        : file.mimetype === 'image/png' ? '.png'
          : file.mimetype === 'image/webp' ? '.webp' : '.pdf'
      const storageKey = `${randomUUID()}${extension}`
      await writeFile(path.join(uploadDirectory, storageKey), file.buffer, { flag: 'wx', mode: 0o600 })
      const safeOriginalName = path.basename(file.originalname.replaceAll('\\', '/'))
      const originalName = Array.from(safeOriginalName)
        .filter((character) => {
          const code = character.charCodeAt(0)
          return code > 31 && (code < 127 || code > 159)
        })
        .join('')
        .slice(0, 255) || 'upload'
      persisted.push({
        storageKey,
        originalName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        purpose: file.fieldname.slice(0, 40),
      })
    }
    return persisted
  } catch (error) {
    await Promise.all(persisted.map((file) => rm(path.join(uploadDirectory, file.storageKey), { force: true })))
    throw error
  }
}

export async function removeFiles(files = []) {
  await Promise.all(files.map((file) => rm(path.join(uploadDirectory, file.storageKey), { force: true })))
}

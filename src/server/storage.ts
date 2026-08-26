import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type FileRecord = {
  id: string
  name: string
  size: number
  mimeType: string
  category: string
  kind: string
  confidence: number
  excerpt: string
  objectKey: string
  createdAt: string
}

const dataDirectory = path.join(process.cwd(), '.dropwell-data')
const filesDirectory = path.join(dataDirectory, 'files')
const indexPath = path.join(dataDirectory, 'library.json')

let mutationQueue = Promise.resolve()

async function ensureStorage() {
  await mkdir(filesDirectory, { recursive: true })
}

function isFileRecord(value: unknown): value is FileRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<FileRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.size === 'number' &&
    typeof record.mimeType === 'string' &&
    typeof record.category === 'string' &&
    typeof record.kind === 'string' &&
    typeof record.confidence === 'number' &&
    typeof record.excerpt === 'string' &&
    typeof record.objectKey === 'string' &&
    typeof record.createdAt === 'string'
  )
}

async function readIndex(): Promise<FileRecord[]> {
  await ensureStorage()

  try {
    const contents = await readFile(indexPath, 'utf8')
    const parsed: unknown = JSON.parse(contents)
    return Array.isArray(parsed) ? parsed.filter(isFileRecord) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeIndex(files: FileRecord[]) {
  const temporaryPath = `${indexPath}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, JSON.stringify(files, null, 2), 'utf8')
    await rename(temporaryPath, indexPath)
  } finally {
    await unlink(temporaryPath).catch(() => {})
  }
}

async function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = mutationQueue
  let release = () => {}
  mutationQueue = new Promise<void>((resolve) => {
    release = resolve
  })

  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

function filePathForKey(objectKey: string) {
  if (!/^[0-9a-f-]{36}$/.test(objectKey)) throw new Error('Invalid file key.')
  return path.join(filesDirectory, objectKey)
}

export async function listStoredFiles() {
  const files = await readIndex()
  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
}

export async function createStoredFile(record: FileRecord, contents: Uint8Array) {
  return withMutationLock(async () => {
    await ensureStorage()
    const destination = filePathForKey(record.objectKey)
    const temporaryPath = `${destination}.${crypto.randomUUID()}.tmp`

    try {
      await writeFile(temporaryPath, contents)
      await rename(temporaryPath, destination)
    } finally {
      await unlink(temporaryPath).catch(() => {})
    }

    try {
      const files = await readIndex()
      await writeIndex([record, ...files.filter((file) => file.id !== record.id)])
    } catch (error) {
      await unlink(destination).catch(() => {})
      throw error
    }

    return record
  })
}

export async function getStoredFile(id: string) {
  const files = await readIndex()
  const record = files.find((file) => file.id === id)
  if (!record) return null

  try {
    const contents = await readFile(filePathForKey(record.objectKey))
    return { record, contents }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function deleteStoredFile(id: string) {
  return withMutationLock(async () => {
    const files = await readIndex()
    const record = files.find((file) => file.id === id)
    if (!record) return false

    const destination = filePathForKey(record.objectKey)
    const tombstone = `${destination}.${crypto.randomUUID()}.delete`
    let moved = false
    try {
      await rename(destination, tombstone)
      moved = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    try {
      await writeIndex(files.filter((file) => file.id !== id))
    } catch (error) {
      if (moved) await rename(tombstone, destination).catch(() => {})
      throw error
    }

    if (moved) await unlink(tombstone).catch(() => {})
    return true
  })
}

export function storageError(error: unknown) {
  if (process.env.NODE_ENV !== 'production') console.error('Dropwell storage error:', error)
  return 'The local file library is unavailable. Please try again.'
}

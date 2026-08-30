import type { Context } from '@octanejs/rsbuild-plugin'
import { api } from '../../convex/_generated/api'
import { CATEGORY_NAMES, categoryFromFileType } from '@/constants/meta'
import type { CategoryName, StoredFile } from '@/types/file'
import { authenticateRequest, RequestError } from './convex'
import {
  createObjectKey,
  createStoredFileUrl,
  deleteStoredFile,
  requirePlatform,
  serveStoredFile,
  storageError,
  uploadStoredFile,
  type AppPlatform,
  type FileRecord
} from './storage'

const MAX_FILE_SIZE = 20 * 1024 * 1024

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' }
  })
}

function cleanText(value: FormDataEntryValue | null, fallback: string, limit: number) {
  if (typeof value !== 'string') return fallback
  return value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit) || fallback
}

function cleanMimeType(value: string) {
  const mimeType = value.trim().toLowerCase()
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : 'application/octet-stream'
}

function cleanFilename(value: string) {
  return value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 255) || 'untitled'
}

async function toStoredFile(platform: AppPlatform, record: FileRecord): Promise<StoredFile> {
  return {
    id: record.id,
    name: record.name,
    size: record.size,
    mimeType: record.mimeType,
    category: CATEGORY_NAMES.find((category) => category === record.category)
      ?? categoryFromFileType(record.name, record.mimeType),
    kind: record.kind,
    confidence: record.confidence,
    excerpt: record.excerpt,
    createdAt: new Date(record.createdAt).toISOString(),
    url: await createStoredFileUrl(platform, record)
  }
}

function fromIndexedFile(record: {
  externalId: string
  name: string
  size: number
  mimeType: string
  category: Exclude<CategoryName, 'All'>
  kind: string
  confidence: number
  excerpt: string
  objectKey: string
  createdAt: number
}): FileRecord {
  return {
    id: record.externalId,
    name: record.name,
    size: record.size,
    mimeType: record.mimeType,
    category: record.category,
    kind: record.kind,
    confidence: record.confidence,
    excerpt: record.excerpt,
    objectKey: record.objectKey,
    createdAt: record.createdAt
  }
}

async function uploadFile(platform: AppPlatform, request: Request) {
  const { client, userId } = await authenticateRequest(request, platform.env.CONVEX_URL)
  const formData = await request.formData()
  const candidate = formData.get('file')
  if (!(candidate instanceof File)) return json({ error: 'Choose a file to upload.' }, 400)
  if (candidate.size === 0 || candidate.size > MAX_FILE_SIZE) {
    return json({ error: 'Files must be between 1 byte and 20 MB.' }, 413)
  }

  const fallbackCategory = categoryFromFileType(candidate.name, candidate.type)
  const requestedCategory = cleanText(formData.get('category'), fallbackCategory, 40)
  const category = CATEGORY_NAMES.find((candidate) => candidate === requestedCategory) ?? fallbackCategory
  const uploadId = crypto.randomUUID()
  const record: FileRecord = {
    id: uploadId,
    name: cleanFilename(candidate.name),
    size: candidate.size,
    mimeType: cleanMimeType(candidate.type),
    category,
    kind: cleanText(formData.get('kind'), 'File', 80),
    confidence: Math.max(0, Math.min(100, Number(cleanText(formData.get('confidence'), '0', 3)) || 0)),
    excerpt: cleanText(formData.get('excerpt'), '', 300),
    objectKey: createObjectKey(userId, uploadId),
    createdAt: Date.now()
  }

  await uploadStoredFile(platform, record, new Uint8Array(await candidate.arrayBuffer()))

  try {
    const indexed = await client.mutation(api.files.create, {
      externalId: record.id,
      name: record.name,
      size: record.size,
      mimeType: record.mimeType,
      category: record.category,
      kind: record.kind,
      confidence: record.confidence,
      excerpt: record.excerpt,
      objectKey: record.objectKey,
      createdAt: record.createdAt
    })
    return json({ file: await toStoredFile(platform, fromIndexedFile(indexed)) }, 201)
  } catch (error) {
    await deleteStoredFile(platform, record.objectKey).catch(() => {})
    throw error
  }
}

export async function handleFiles(context: Context) {
  try {
    const platform = requirePlatform(context.platform)
    if (context.request.method === 'POST') return await uploadFile(platform, context.request)

    if (context.request.method === 'GET') {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      const indexed = await client.query(api.files.list, { limit: 200 })
      const files = await Promise.all(
        indexed.map((file) => toStoredFile(platform, fromIndexedFile(file)))
      )
      return json({ files })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    return json({ error: storageError(error) }, 503)
  }
}

export async function handleFileById(context: Context) {
  try {
    const platform = requirePlatform(context.platform)
    const externalId = context.params.id

    if (context.request.method === 'GET') {
      return await serveStoredFile(platform, externalId, context.request)
    }

    if (context.request.method === 'DELETE') {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      const indexed = await client.query(api.files.getByExternalId, { externalId })
      if (!indexed) return json({ error: 'File not found.' }, 404)
      await deleteStoredFile(platform, indexed.objectKey)
      await client.mutation(api.files.remove, { externalId })
      return json({ ok: true })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    return json({ error: storageError(error) }, 503)
  }
}

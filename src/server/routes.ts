import type { Context } from '@octanejs/rsbuild-plugin'
import { api } from '../../convex/_generated/api'
import { CATEGORY_NAMES, MAX_FILE_SIZE, categoryFromFileType } from '@/constants/meta'
import type { StoredFile } from '@/types/file'
import { classifyWithJev } from './jev'
import { authenticateRequest, RequestError } from './convex'
import {
  createObjectKey,
  createStoredFileUrl,
  deleteStoredFile,
  downloadStoredFile,
  requirePlatform,
  serveStoredFile,
  storageError,
  uploadStoredFile,
  type AppPlatform,
  type FileRecord
} from './storage'

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
    method: record.method,
    text: record.text,
    ocrConfidence: record.ocrConfidence,
    pagesRead: record.pagesRead,
    pageCount: record.pageCount,
    warning: record.warning,
    jev: record.jev,
    createdAt: new Date(record.createdAt).toISOString(),
    url: await createStoredFileUrl(platform, record),
    thumbnailUrl: record.thumbnailKey ? await createStoredFileUrl(platform, { ...record, objectKey: record.thumbnailKey }) : undefined
  }
}

function fromIndexedFile(record: Omit<FileRecord, 'id'> & { externalId: string; ownerId: string }): FileRecord {
  if (record.objectKey !== createObjectKey(record.ownerId, record.externalId) ||
    (record.thumbnailKey !== undefined && record.thumbnailKey !== `drop/${record.ownerId}/thumbnails/${record.externalId}`)) {
    throw new RequestError(403, 'This file has invalid storage metadata.')
  }
  return { ...record, id: record.externalId }
}

function optionalNumber(form: FormData, name: string, max: number) {
  const value = form.get(name)
  if (typeof value !== 'string') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.round(number))) : undefined
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
  const requestedId = formData.get('uploadId')
  const uploadId = typeof requestedId === 'string' && /^[a-f0-9-]{36}$/i.test(requestedId) ? requestedId : crypto.randomUUID()
  const existing = await client.query(api.files.getByExternalId, { externalId: uploadId })
  if (existing) return json({ file: await toStoredFile(platform, fromIndexedFile(existing)) })
  const record: FileRecord = {
    id: uploadId,
    name: cleanFilename(candidate.name),
    size: candidate.size,
    mimeType: cleanMimeType(candidate.type),
    category,
    kind: cleanText(formData.get('kind'), 'File', 80),
    confidence: Math.max(0, Math.min(100, Number(cleanText(formData.get('confidence'), '0', 3)) || 0)),
    excerpt: cleanText(formData.get('excerpt'), '', 300),
    method: cleanText(formData.get('method'), 'File type + filename', 100),
    text: typeof formData.get('text') === 'string' ? String(formData.get('text')).replace(/\u0000/g, '').slice(0, 60000) : undefined,
    ocrConfidence: optionalNumber(formData, 'ocrConfidence', 100),
    pagesRead: optionalNumber(formData, 'pagesRead', 10000),
    pageCount: optionalNumber(formData, 'pageCount', 10000),
    warning: cleanText(formData.get('warning'), '', 300),
    objectKey: createObjectKey(userId, uploadId),
    createdAt: Date.now()
  }

  await classifyWithJev(record, platform.env.TYPESAFE_API_KEY, request.signal)
  const stored = await toStoredFile(platform, record)
  await uploadStoredFile(platform, record, new Uint8Array(await candidate.arrayBuffer()))

  const thumbnail = formData.get('thumbnail')
  if (thumbnail instanceof File && thumbnail.size > 0 && thumbnail.size <= 512 * 1024 && ['image/webp', 'image/jpeg', 'image/png'].includes(thumbnail.type)) {
    const key = `drop/${userId}/thumbnails/${uploadId}`
    try {
      await uploadStoredFile(platform, { ...record, objectKey: key, mimeType: thumbnail.type }, new Uint8Array(await thumbnail.arrayBuffer()))
      record.thumbnailKey = key
      stored.thumbnailUrl = await createStoredFileUrl(platform, { ...record, objectKey: key })
    } catch { /* The complete original remains usable when a thumbnail cannot be saved. */ }
  }
  try {
    await client.mutation(api.files.create, {
      externalId: record.id,
      name: record.name,
      size: record.size,
      mimeType: record.mimeType,
      category: record.category,
      kind: record.kind,
      confidence: record.confidence,
      excerpt: record.excerpt,
      method: record.method,
      text: record.text,
      ocrConfidence: record.ocrConfidence,
      pagesRead: record.pagesRead,
      pageCount: record.pageCount,
      warning: record.warning,
      jev: record.jev,
      objectKey: record.objectKey,
      thumbnailKey: record.thumbnailKey,
      createdAt: record.createdAt
    })
    return json({ file: stored }, 201)
  } catch (error) {
    await deleteStoredFile(platform, record.objectKey).catch(() => {})
    if (record.thumbnailKey) await deleteStoredFile(platform, record.thumbnailKey).catch(() => {})
    throw error
  }
}

export async function handleFiles(context: Context) {
  try {
    const platform = requirePlatform(context.platform)
    if (context.request.method === 'POST') return await uploadFile(platform, context.request)

    if (context.request.method === 'GET') {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      const search = new URL(context.request.url).searchParams.get('search')?.trim()
      const indexed = search ? await client.query(api.files.search, { search: search.slice(0, 200) }) : await client.query(api.files.list, { limit: 200 })
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

    const url = new URL(context.request.url)
    const reading = context.request.method === 'GET' || context.request.method === 'HEAD'
    const downloading = url.searchParams.get('download') === '1'
    if (reading && url.searchParams.get('metadata') !== '1' && !downloading) {
      return await serveStoredFile(platform, externalId, context.request)
    }
    if (reading && downloading) {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      const indexed = await client.query(api.files.getByExternalId, { externalId })
      if (!indexed) return json({ error: 'File not found.' }, 404)
      return await downloadStoredFile(platform, fromIndexedFile(indexed), context.request)
    }
    if (context.request.method === 'GET' || context.request.method === 'PATCH') {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      let indexed = await client.query(api.files.getByExternalId, { externalId })
      if (!indexed) return json({ error: 'File not found.' }, 404)
      if (context.request.method === 'PATCH') {
        const body: unknown = await context.request.json().catch(() => null)
        const category = body && typeof body === 'object' && 'category' in body ? body.category : null
        const validCategory = CATEGORY_NAMES.find((item) => item === category)
        if (!validCategory) return json({ error: 'Choose a valid folder.' }, 400)
        indexed = await client.mutation(api.files.reclassify, { externalId, category: validCategory })
      }
      return json({ file: await toStoredFile(platform, fromIndexedFile(indexed)) })
    }

    if (context.request.method === 'DELETE') {
      const { client } = await authenticateRequest(context.request, platform.env.CONVEX_URL)
      const indexed = await client.query(api.files.getByExternalId, { externalId })
      if (!indexed) return json({ error: 'File not found.' }, 404)
      await deleteStoredFile(platform, indexed.objectKey)
      if (indexed.thumbnailKey) await deleteStoredFile(platform, indexed.thumbnailKey)
      await client.mutation(api.files.remove, { externalId })
      return json({ ok: true })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    return json({ error: storageError(error) }, 503)
  }
}

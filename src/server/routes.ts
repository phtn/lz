import type { Context } from '@octanejs/rsbuild-plugin'
import { CATEGORY_NAMES, categoryFromFileType } from '@/constants/meta'
import {
  createStoredFile,
  deleteStoredFile,
  getStoredFile,
  listStoredFiles,
  storageError,
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

function contentDisposition(name: string) {
  const safeAscii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function previewContentDisposition(name: string) {
  const safeAscii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

async function uploadFile(request: Request) {
  const formData = await request.formData()
  const candidate = formData.get('file')
  if (!(candidate instanceof File)) return json({ error: 'Choose a file to upload.' }, 400)
  if (candidate.size === 0 || candidate.size > MAX_FILE_SIZE) {
    return json({ error: 'Files must be between 1 byte and 20 MB.' }, 413)
  }

  const fallbackCategory = categoryFromFileType(candidate.name, candidate.type)
  const requestedCategory = cleanText(formData.get('category'), fallbackCategory, 40)
  const category = CATEGORY_NAMES.find((candidate) => candidate === requestedCategory) ?? fallbackCategory
  const kind = cleanText(formData.get('kind'), 'File', 80)
  const excerpt = cleanText(formData.get('excerpt'), '', 300)
  const confidence = Math.max(0, Math.min(100, Number(cleanText(formData.get('confidence'), '0', 3)) || 0))
  const id = crypto.randomUUID()
  const record: FileRecord = {
    id,
    name: cleanFilename(candidate.name),
    size: candidate.size,
    mimeType: cleanMimeType(candidate.type),
    category,
    kind,
    confidence,
    excerpt,
    objectKey: id,
    createdAt: new Date().toISOString()
  }
  const contents = new Uint8Array(await candidate.arrayBuffer())
  return json({ file: await createStoredFile(record, contents) }, 201)
}

export async function handleFiles(context: Context) {
  try {
    if (context.request.method === 'GET') return json({ files: await listStoredFiles() })
    if (context.request.method === 'POST') return uploadFile(context.request)
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    return json({ error: storageError(error) }, 503)
  }
}

export async function handleFileById(context: Context) {
  try {
    const id = context.params.id
    if (context.request.method === 'DELETE') {
      const deleted = await deleteStoredFile(id)
      return deleted ? json({ ok: true }) : json({ error: 'File not found.' }, 404)
    }

    if (context.request.method === 'GET') {
      const storedFile = await getStoredFile(id)
      if (!storedFile) return json({ error: 'File not found.' }, 404)
      const isPreview = new URL(context.request.url).searchParams.has('preview')
      return new Response(new Uint8Array(storedFile.contents), {
        headers: {
          'cache-control': 'private, no-store',
          'content-disposition': isPreview
            ? previewContentDisposition(storedFile.record.name)
            : contentDisposition(storedFile.record.name),
          'content-length': String(storedFile.contents.byteLength),
          'content-type': storedFile.record.mimeType
        }
      })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    return json({ error: storageError(error) }, 503)
  }
}

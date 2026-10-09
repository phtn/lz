import type { CloudflarePlatform } from '@octanejs/adapter-cloudflare'
import type { CategoryName, JevAssessment } from '@/types/file'

const FILE_URL_TTL_SECONDS = 15 * 60

export type CloudflareEnv = {
  DROPZONE_FILES: R2Bucket
  CONVEX_URL: string
  FILE_URL_SIGNING_KEY: string
  TYPESAFE_API_KEY?: string
}

export type AppPlatform = CloudflarePlatform<CloudflareEnv>

export type FileRecord = {
  id: string
  name: string
  size: number
  mimeType: string
  category: Exclude<CategoryName, 'All'>
  kind: string
  confidence: number
  excerpt: string
  objectKey: string
  thumbnailKey?: string
  createdAt: number
  method?: string
  text?: string
  ocrConfidence?: number
  pagesRead?: number
  pageCount?: number
  warning?: string
  jev?: JevAssessment
}

function contentDisposition(name: string, disposition: 'inline' | 'attachment' = 'inline') {
  const safeAscii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`
}

function requireSigningKey(platform: AppPlatform) {
  const signingKey = platform.env.FILE_URL_SIGNING_KEY?.trim()
  if (!signingKey || signingKey.length < 32) {
    throw new Error('FILE_URL_SIGNING_KEY must contain at least 32 characters.')
  }
  return signingKey
}

function requireBucket(platform: AppPlatform) {
  const bucket = platform.env.DROPZONE_FILES
  if (!bucket) throw new Error('The DROPZONE_FILES R2 binding is not configured.')
  return bucket
}

let cachedSecret = ''
let cachedSigningKey: Promise<CryptoKey> | undefined

async function hmacKey(secret: string) {
  if (cachedSecret === secret && cachedSigningKey) return cachedSigningKey
  cachedSecret = secret
  cachedSigningKey = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  return cachedSigningKey
}

function signaturePayload(externalId: string, objectKey: string, expires: number) {
  return JSON.stringify([externalId, objectKey, expires])
}

function toBase64Url(bytes: ArrayBuffer) {
  const values = new Uint8Array(bytes)
  let binary = ''
  for (const value of values) binary += String.fromCharCode(value)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const padded = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

export function requirePlatform(platform: unknown): AppPlatform {
  const candidate = platform as AppPlatform | undefined
  if (!candidate?.env) throw new Error('Cloudflare Worker bindings are unavailable.')
  requireBucket(candidate)
  return candidate
}

export function createObjectKey(userId: string, uploadId: string) {
  return `drop/${userId}/${uploadId}`
}

export async function uploadStoredFile(
  platform: AppPlatform,
  record: FileRecord,
  contents: Uint8Array
) {
  await requireBucket(platform).put(record.objectKey, contents, {
    httpMetadata: {
      contentType: record.mimeType,
      contentDisposition: contentDisposition(record.name)
    },
    customMetadata: {
      uploadId: record.id
    }
  })
}

export async function deleteStoredFile(platform: AppPlatform, objectKey: string) {
  await requireBucket(platform).delete(objectKey)
}

export async function createStoredFileUrl(platform: AppPlatform, record: FileRecord) {
  const expires = Math.floor(Date.now() / 1000) + FILE_URL_TTL_SECONDS
  const payload = new TextEncoder().encode(signaturePayload(record.id, record.objectKey, expires))
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(requireSigningKey(platform)),
    payload
  )
  const query = new URLSearchParams({
    key: record.objectKey,
    expires: String(expires),
    signature: toBase64Url(signature)
  })
  return `/api/files/${encodeURIComponent(record.id)}?${query}`
}

async function hasValidFileSignature(
  platform: AppPlatform,
  externalId: string,
  objectKey: string,
  expiresText: string,
  signatureText: string
) {
  const expires = Number(expiresText)
  const now = Math.floor(Date.now() / 1000)
  if (
    !Number.isSafeInteger(expires)
    || expires < now
    || expires > now + FILE_URL_TTL_SECONDS + 60
  ) {
    return false
  }
  if (!objectKey.startsWith('drop/') || objectKey.split('/').at(-1) !== externalId) return false

  const signature = fromBase64Url(signatureText)
  if (!signature) return false
  const payload = new TextEncoder().encode(signaturePayload(externalId, objectKey, expires))
  return await crypto.subtle.verify(
    'HMAC',
    await hmacKey(requireSigningKey(platform)),
    signature,
    payload
  )
}

function resolveRange(range: R2Range, size: number) {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, size)
    return { offset: size - length, length }
  }
  const offset = range.offset ?? 0
  return { offset, length: range.length ?? size - offset }
}

export async function serveStoredFile(
  platform: AppPlatform,
  externalId: string,
  request: Request
) {
  const url = new URL(request.url)
  const objectKey = url.searchParams.get('key') ?? ''
  const expires = url.searchParams.get('expires') ?? ''
  const signature = url.searchParams.get('signature') ?? ''
  if (!await hasValidFileSignature(platform, externalId, objectKey, expires, signature)) {
    return new Response('This file link is invalid or has expired.', { status: 403 })
  }

  return serveObject(platform, objectKey, request)
}

export async function downloadStoredFile(platform: AppPlatform, record: FileRecord, request: Request) {
  return serveObject(platform, record.objectKey, request, record.name)
}

async function serveObject(platform: AppPlatform, objectKey: string, request: Request, downloadName?: string) {

  const range = request.headers.get('range')
  const bucket = requireBucket(platform)
  const object = request.method === 'HEAD' ? await bucket.head(objectKey) : await bucket.get(
    objectKey, range ? { range: new Headers({ range }) } : undefined
  )
  if (!object) return new Response('File not found.', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  if (downloadName) headers.set('content-disposition', contentDisposition(downloadName, 'attachment'))
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', objectKey.includes('/thumbnails/') ? 'private, max-age=300' : 'private, no-store')
  headers.set('etag', object.httpEtag)

  if (object.range) {
    const { offset, length } = resolveRange(object.range, object.size)
    headers.set('content-length', String(length))
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
  } else {
    headers.set('content-length', String(object.size))
  }

  return new Response('body' in object ? (object as R2ObjectBody).body : null, {
    status: object.range ? 206 : 200,
    headers
  })
}

export function storageError(error: unknown) {
  console.error('DropZone storage error:', error)
  return 'Your cloud file library is unavailable. Please try again.'
}

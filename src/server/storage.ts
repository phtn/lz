import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { CategoryName } from '@/types/file'

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
  createdAt: number
}

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

let client: S3Client | undefined
let config: R2Config | undefined

function requiredEnvironmentVariable(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function getR2Config(): R2Config {
  config ??= {
    accountId: requiredEnvironmentVariable('R2_ACCOUNT_ID'),
    accessKeyId: requiredEnvironmentVariable('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnvironmentVariable('R2_SECRET_ACCESS_KEY'),
    bucket: requiredEnvironmentVariable('R2_BUCKET_NAME')
  }
  return config
}

function getR2Client() {
  const r2 = getR2Config()
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey
    }
  })
  return client
}

function inlineContentDisposition(name: string) {
  const safeAscii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function createObjectKey(userId: string, uploadId: string) {
  return `drop/${userId}/${uploadId}`
}

export async function uploadStoredFile(record: FileRecord, contents: Uint8Array) {
  const r2 = getR2Config()
  await getR2Client().send(new PutObjectCommand({
    Bucket: r2.bucket,
    Key: record.objectKey,
    Body: contents,
    ContentLength: record.size,
    ContentType: record.mimeType,
    ContentDisposition: inlineContentDisposition(record.name),
    Metadata: {
      uploadId: record.id
    }
  }))
}

export async function deleteStoredFile(objectKey: string) {
  const r2 = getR2Config()
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: r2.bucket,
    Key: objectKey
  }))
}

export async function createStoredFileUrl(objectKey: string) {
  const r2 = getR2Config()
  return await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: r2.bucket, Key: objectKey }),
    { expiresIn: 15 * 60 }
  )
}

export function storageError(error: unknown) {
  if (process.env.NODE_ENV !== 'production') console.error('DropZone storage error:', error)
  return 'Your cloud file library is unavailable. Please try again.'
}

import { beforeEach, expect, test, vi } from 'vitest'
import { handleFileById } from '../../src/server/routes'
import { RequestError } from '../../src/server/convex'
import { createStoredFileUrl, serveStoredFile, type AppPlatform, type FileRecord } from '../../src/server/storage'

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), query: vi.fn(), get: vi.fn(), head: vi.fn() }))
vi.mock('../../src/server/convex', async (original) => ({
  ...await original<typeof import('../../src/server/convex')>(), authenticateRequest: mocks.authenticate,
}))
const bytes = 'Complete original contents'
const record: FileRecord = {
  id: 'original-id', name: "October's résumé.txt", size: bytes.length, mimeType: 'text/plain',
  category: 'Documents', kind: 'Document', confidence: 100, excerpt: '',
  objectKey: 'drop/owner/original-id', createdAt: 1700000000000,
}
const platform = { env: {
  DROPZONE_FILES: { get: mocks.get, head: mocks.head }, CONVEX_URL: 'https://example.convex.cloud',
  FILE_URL_SIGNING_KEY: 'test-only-signing-key-with-more-than-32-characters',
} } as unknown as AppPlatform
function object(body = true) {
  return {
    ...(body ? { body: new Blob([bytes]).stream() } : {}), size: bytes.length, httpEtag: '"original"',
    writeHttpMetadata(headers: Headers) {
      headers.set('content-type', 'text/plain')
      headers.set('content-disposition', 'inline; filename="old-name.txt"')
    },
  }
}
function context(method = 'GET') {
  return { platform, params: { id: record.id }, request: new Request(`https://example.test/api/files/${record.id}?download=1`, {
    method, headers: { authorization: 'Bearer owner-token' },
  }) } as unknown as Parameters<typeof handleFileById>[0]
}
beforeEach(() => {
  mocks.authenticate.mockReset().mockResolvedValue({ userId: 'owner', client: { query: mocks.query } })
  mocks.query.mockReset().mockResolvedValue({ ...record, externalId: record.id, ownerId: 'owner' })
  mocks.get.mockReset().mockImplementation(async () => object())
  mocks.head.mockReset().mockImplementation(async () => object(false))
})
test('authenticated downloads return the complete original with its UTF-8 filename', async () => {
  const response = await handleFileById(context())
  expect(response.status).toBe(200)
  expect(await response.text()).toBe(bytes)
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="October\'s r_sum_.txt"; filename*=UTF-8\'\'October%27s%20r%C3%A9sum%C3%A9.txt')
  expect(response.headers.get('content-length')).toBe(String(bytes.length))
  expect(mocks.get).toHaveBeenCalledWith(record.objectKey, undefined)
})
test('download and signed preview HEAD requests return metadata without reading the file body', async () => {
  const download = await handleFileById(context('HEAD'))
  expect(download.status).toBe(200)
  expect(await download.text()).toBe('')
  const url = await createStoredFileUrl(platform, record)
  const preview = await serveStoredFile(platform, record.id, new Request(`https://example.test${url}`, { method: 'HEAD' }))
  expect(preview.status).toBe(200)
  expect(preview.headers.get('content-length')).toBe(String(bytes.length))
  expect(await preview.text()).toBe('')
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.head).toHaveBeenCalledTimes(2)
})
test('rejects expired preview links while downloads use the authenticated owner record', async () => {
  const url = new URL(await createStoredFileUrl(platform, record), 'https://example.test')
  url.searchParams.set('expires', '1')
  expect((await serveStoredFile(platform, record.id, new Request(url))).status).toBe(403)
  expect(mocks.get).not.toHaveBeenCalled()
  expect((await handleFileById(context())).status).toBe(200)
})
test('rejects unsigned-out sessions and files outside the caller’s library', async () => {
  mocks.authenticate.mockRejectedValueOnce(new RequestError(401, 'Sign in to access your files.'))
  expect((await handleFileById(context())).status).toBe(401)
  mocks.query.mockResolvedValueOnce(null)
  expect((await handleFileById(context())).status).toBe(404)
  expect(mocks.get).not.toHaveBeenCalled()
})
test('reports missing originals instead of returning file metadata as a download', async () => {
  mocks.get.mockResolvedValueOnce(null)
  const response = await handleFileById(context())
  expect(response.status).toBe(404)
  expect(await response.text()).toBe('File not found.')
})

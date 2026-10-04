import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { handleFiles } from '../../src/server/routes'
import { JEV_CRITERIA } from '../../src/server/jev'
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), put: vi.fn() }))
vi.mock('../../src/server/convex', async (original) => ({
  ...await original<typeof import('../../src/server/convex')>(),
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'owner', client: { query: mocks.query, mutation: mocks.mutation } })
}))
vi.mock('../../src/server/storage', async (original) => ({
  ...await original<typeof import('../../src/server/storage')>(),
  createStoredFileUrl: vi.fn().mockResolvedValue('/signed-original'), uploadStoredFile: mocks.put
}))
beforeEach(() => { mocks.query.mockReset().mockResolvedValue(null); mocks.mutation.mockReset().mockResolvedValue({}); mocks.put.mockReset().mockResolvedValue(undefined) })
afterEach(() => vi.unstubAllGlobals())
function context() {
  const form = new FormData()
  form.append('file', new File(['original bytes'], 'scan.png', { type: 'image/png' }))
  form.append('uploadId', '12345678-1234-1234-1234-123456789012')
  form.append('category', 'Images'); form.append('confidence', '60')
  form.append('text', 'INVOICE INV-1001. Supplier: Example Company. Customer: Example Business. Services: bookkeeping for October. Amount due USD 250. Please pay by 31 October 2026.')
  form.append('ocrConfidence', '94')
  return { request: new Request('https://example.test/api/files', { method: 'POST', body: form }), platform: { env: { DROPZONE_FILES: {}, CONVEX_URL: 'https://example.convex.cloud', TYPESAFE_API_KEY: 'test-secret' } } } as unknown as Parameters<typeof handleFiles>[0]
}
test('upload persists and returns server Jev routing before completion', async () => {
  const probabilities = Object.fromEntries(Object.keys(JEV_CRITERIA).map((key) => [key, key === 'Invoices' ? 1 : 0]))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ model: 'jev-1.13.0', answers: { folder: { type: 'choice', choice: 'Invoices', confidence: 1, probabilities }, evidence: { type: 'noul', noul: 0.99 } } })))
  const response = await handleFiles(context())
  expect(response.status).toBe(201)
  const { file } = await response.json()
  expect(file.category).toBe('Invoices')
  expect(file.jev.status).toBe('accepted')
  expect(mocks.mutation.mock.calls[0]?.[1]).toMatchObject({ category: 'Invoices', confidence: 100, jev: { status: 'accepted', model: 'jev-1.13.0' } })
  expect(mocks.put).toHaveBeenCalledOnce()
})
test('provider outage still stores the original and persists visible review status', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')))
  const response = await handleFiles(context())
  expect(response.status).toBe(201)
  expect((await response.json()).file).toMatchObject({ category: 'Images', jev: { status: 'unavailable' } })
  expect(mocks.put).toHaveBeenCalledOnce()
  expect(mocks.mutation.mock.calls[0]?.[1].jev.status).toBe('unavailable')
})

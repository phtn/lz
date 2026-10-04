import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { CATEGORY_NAMES } from '../../src/constants/meta'
const modules = import.meta.glob('../../convex/**/*.ts')
const metadata = {
  externalId: 'test-file', name: 'invoice.txt', size: 100, mimeType: 'text/plain',
  category: 'Invoices' as const, kind: 'Invoice', confidence: 91, excerpt: 'Invoice 123',
  objectKey: 'drop/test/test-file', createdAt: 1700000000000,
  text: 'Longer extracted text', method: 'Local text analysis', pagesRead: 2, pageCount: 2
}
async function setup() {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: 'owner', issuer: 'https://test.example' })
  const stranger = t.withIdentity({ subject: 'stranger', issuer: 'https://test.example' })
  const ownerId = await owner.mutation(api.users.ensureCurrent)
  await stranger.mutation(api.users.ensureCurrent)
  return { t, owner, stranger, data: { ...metadata, objectKey: `drop/${ownerId}/${metadata.externalId}` } }
}
describe('cloud file metadata', () => {
  test('persists Jev evidence and keeps original scores when the owner corrects a folder', async () => {
    const { owner, stranger, data } = await setup()
    const jev = { status: 'review' as const, policyVersion: 'document-routing-v1', model: 'jev-1.13.0', reason: 'Ambiguous', suggestedCategory: 'Invoices' as const, confidence: 0.6, probability: 0.65, margin: 0.3, evidenceProbability: 0.8, probabilities: { Invoices: 0.65, Receipts: 0.35 } }
    await owner.mutation(api.files.create, { ...data, jev })
    expect((await owner.query(api.files.list))[0]?.jev).toEqual(jev)
    await expect(stranger.mutation(api.files.reclassify, { externalId: data.externalId, category: 'Receipts' })).rejects.toThrow()
    const corrected = await owner.mutation(api.files.reclassify, { externalId: data.externalId, category: 'Receipts' })
    expect(corrected.jev).toMatchObject({ ...jev, status: 'corrected' })
    expect(corrected.jev?.reviewedAt).toBeTypeOf('number')
    expect(corrected.category).toBe('Receipts')
  })
  test('lists compact records and retrieves complete OCR text on demand', async () => {
    const { owner, data } = await setup()
    await owner.mutation(api.files.create, data)
    const files = await owner.query(api.files.list)
    expect(files).toHaveLength(1)
    expect(files[0]).not.toHaveProperty('text')
    expect(files[0]).not.toHaveProperty('searchText')
    const detail = await owner.query(api.files.getByExternalId, { externalId: metadata.externalId })
    expect(detail?.text).toBe(metadata.text)
    const metadataRecord = await owner.run((ctx) => ctx.db.get('files', files[0]._id))
    expect(metadataRecord).not.toHaveProperty('text')
    expect(metadataRecord).not.toHaveProperty('searchText')
  })
  test('retrying the same upload does not create a duplicate', async () => {
    const { owner, data } = await setup()
    const first = await owner.mutation(api.files.create, data)
    const retry = await owner.mutation(api.files.create, data)
    expect(first._id).toBe(retry._id)
    expect(await owner.query(api.files.list)).toHaveLength(1)
  })
  test('accepts every folder and persists corrections', async () => {
    const { owner, data } = await setup()
    await owner.mutation(api.files.create, data)
    for (const category of CATEGORY_NAMES) {
      const result = await owner.mutation(api.files.reclassify, { externalId: metadata.externalId, category })
      expect(result.category).toBe(category)
      expect(result.text).toBe(metadata.text)
    }
  })
  test('other users cannot read, move, or remove an owner’s file', async () => {
    const { owner, stranger, data } = await setup()
    await owner.mutation(api.files.create, data)
    expect(await stranger.query(api.files.list)).toEqual([])
    expect(await stranger.query(api.files.getByExternalId, { externalId: metadata.externalId })).toBeNull()
    await expect(stranger.mutation(api.files.reclassify, { externalId: metadata.externalId, category: 'Legal' })).rejects.toThrow('File not found')
    expect(await stranger.mutation(api.files.remove, { externalId: metadata.externalId })).toBe(false)
    expect(await owner.query(api.files.list)).toHaveLength(1)
  })
  test('searches beyond the excerpt and scopes results to the owner', async () => {
    const { owner, stranger, data } = await setup()
    await owner.mutation(api.files.create, { ...data, text: 'The uncommon astronomy phrase is only in full extracted text' })
    expect(await owner.query(api.files.search, { search: 'astronomy' })).toHaveLength(1)
    expect(await stranger.query(api.files.search, { search: 'astronomy' })).toEqual([])
  })
  test('deletion removes the OCR content and its search entry', async () => {
    const { owner, data } = await setup()
    const created = await owner.mutation(api.files.create, data)
    expect(await owner.mutation(api.files.remove, { externalId: metadata.externalId })).toBe(true)
    expect(await owner.run((ctx) => ctx.db.query('fileContents').withIndex('by_fileId', (q) => q.eq('fileId', created._id)).unique())).toBeNull()
    expect(await owner.query(api.files.search, { search: 'Invoice' })).toEqual([])
  })
  test('rejects original and thumbnail paths outside the owner’s namespace', async () => {
    const { owner, data } = await setup()
    await expect(owner.mutation(api.files.create, { ...data, objectKey: 'drop/another-account/test-file' })).rejects.toThrow('Storage paths')
    await expect(owner.mutation(api.files.create, { ...data, thumbnailKey: 'drop/another-account/thumbnails/test-file' })).rejects.toThrow('Storage paths')
  })
  test('rejects unauthenticated writes and invalid folders', async () => {
    const { t, owner, data } = await setup()
    await expect(t.mutation(api.files.create, data)).rejects.toThrow('Unauthenticated')
    await expect(owner.mutation(api.files.create, { ...data, category: 'Invalid' as 'Legal' })).rejects.toThrow()
  })
})

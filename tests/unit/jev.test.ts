import { afterEach, describe, expect, test, vi } from 'vitest'
import { classifyWithJev, JEV_CRITERIA, parseJevAssessment } from '../../src/server/jev'
import type { FileRecord } from '../../src/server/storage'
const source = 'INVOICE 123. Supplier: Example Company. Customer: Example Business. Services provided: bookkeeping. Amount due USD 250. Payment due 31 October 2026.'
const file = (): FileRecord => ({ id: 'test', name: 'scan.png', size: 100, mimeType: 'image/png', category: 'Images', kind: 'Image', confidence: 60, excerpt: source, method: 'On-device OCR', text: source, ocrConfidence: 94, objectKey: 'drop/user/test', createdAt: 1 })
function answer(selected = 'Invoices', probability = 0.97, confidence = 0.95, evidence = 0.99) {
  const probabilities = Object.fromEntries(Object.keys(JEV_CRITERIA).map((key) => [key, 0]))
  probabilities[selected] = probability
  probabilities[selected === 'Documents' ? 'Invoices' : 'Documents'] = 1 - probability
  return { model: 'jev-1.13.0', answers: { folder: { type: 'choice', choice: selected, probabilities, confidence }, evidence: { type: 'noul', noul: evidence } } }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('Jev routing and confidence gates', () => {
  test('runs only on the server endpoint, sends source evidence, and files a strong result', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(answer()))
    vi.stubGlobal('fetch', fetch)
    const record = file()
    await classifyWithJev(record, 'test-secret')
    expect(record.category).toBe('Invoices')
    expect(record.confidence).toBe(95)
    expect(record.jev).toMatchObject({ status: 'accepted', probability: 0.97, confidence: 0.95 })
    const [url, options] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    const request = JSON.parse(options.body)
    expect(request.state.extractedText).toBe(source)
    expect(request.state).not.toHaveProperty('category')
    expect(Object.keys(request.questions.folder.criteria)).toHaveLength(29)
    expect(options.headers.authorization).toBe('Bearer test-secret')
  })
  test.each([
    ['ambiguous', () => file(), answer('Invoices', 0.6, 0.59)],
    ['poor OCR', () => ({ ...file(), ocrConfidence: 50 }), answer()],
    ['short text', () => ({ ...file(), text: 'Invoice 123' }), answer()],
    ['partial PDF', () => ({ ...file(), pageCount: 20, pagesRead: 12 }), answer()],
    ['extraction warning', () => ({ ...file(), warning: 'One page was unreadable' }), answer()],
    ['unclear evidence', () => file(), answer('Invoices', 0.97, 0.95, 0.3)],
    ['unknown', () => file(), answer('Unknown')],
    ['truncated text', () => ({ ...file(), text: source.repeat(200) }), answer()]
  ])('keeps the fallback and raw scores for %s', async (_name, makeRecord, payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
    const record = makeRecord()
    await classifyWithJev(record, 'test-secret')
    expect(record.category).toBe('Images')
    expect(record.confidence).toBe(60)
    expect(record.jev?.status).toBe('review')
    expect(record.jev?.confidence).toBe(payload.answers.folder.confidence)
  })
  test('rejects missing, impossible, and unknown answer distributions', () => {
    const missing = answer(); delete missing.answers.folder.probabilities.Images
    const invalid = answer(); invalid.answers.folder.probabilities.Invoices = 2
    const unknown = answer(); unknown.answers.folder.choice = 'Invented'
    const inconsistent = answer(); inconsistent.answers.folder.choice = 'Documents'
    for (const payload of [missing, invalid, unknown, inconsistent, { answers: {} }]) expect(() => parseJevAssessment(payload, file(), false)).toThrow()
  })
  test('no text or no key makes no external request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const empty = { ...file(), text: '' }; await classifyWithJev(empty, 'test-secret')
    expect(empty.jev?.status).toBe('skipped')
    const missing = file(); await classifyWithJev(missing, undefined)
    expect(missing.jev?.status).toBe('unavailable')
    expect(fetch).not.toHaveBeenCalled()
  })
  test('provider errors do not lose uploads or expose upstream diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private diagnostic', { status: 401 })))
    const record = file(); await classifyWithJev(record, 'test-secret')
    expect(record.jev?.status).toBe('unavailable')
    expect(JSON.stringify(record)).not.toContain('private diagnostic')
    expect(record.category).toBe('Images')
  })
  test('transient errors retry once with backoff', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 })).mockResolvedValueOnce(Response.json(answer()))
    vi.stubGlobal('fetch', fetch)
    const record = file(); const classification = classifyWithJev(record, 'test-secret')
    await vi.advanceTimersByTimeAsync(750); await classification
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(record.jev?.status).toBe('accepted')
  })
  test('cancellation propagates instead of reporting success', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(classifyWithJev(file(), 'test-secret', controller.signal)).rejects.toThrow()
  })
})

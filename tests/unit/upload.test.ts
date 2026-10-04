import { afterEach, describe, expect, test, vi } from 'vitest'
vi.mock('../../src/lib/firebase', () => ({ getCurrentUser: () => ({ uid: 'owner', getIdToken: async () => 'test-token' }) }))
import { uploadFile } from '../../src/lib/upload'
class MockXHR {
  static last: MockXHR
  upload: { onprogress?: (event: { loaded: number; total: number; lengthComputable: boolean }) => void; onload?: () => void } = {}
  onload?: () => void
  onerror?: () => void
  onabort?: () => void
  ontimeout?: () => void
  responseType = ''
  timeout = 0
  status = 201
  response: unknown = { file: { id: 'stored', name: 'file.txt' } }
  constructor() { MockXHR.last = this }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() { this.onabort?.() }
}
afterEach(() => vi.unstubAllGlobals())
describe('measured upstream uploads', () => {
  test('reports actual transfer percent, waits for server confirmation, then completes', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR)
    const progress = vi.fn()
    const sent = vi.fn()
    const controller = new AbortController()
    const pending = uploadFile(new FormData(), 'owner', progress, sent, controller.signal)
    await Promise.resolve(); await Promise.resolve()
    const xhr = MockXHR.last
    xhr.upload.onprogress?.({ loaded: 1000, total: 1000, lengthComputable: true })
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ loaded: 1000, percent: 100 }))
    xhr.upload.onload?.()
    expect(sent).toHaveBeenCalledOnce()
    let completed = false
    void pending.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    xhr.onload?.()
    await expect(pending).resolves.toMatchObject({ id: 'stored' })
  })
  test('rejects interrupted uploads and changed accounts', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR)
    const pending = uploadFile(new FormData(), 'owner', vi.fn(), vi.fn(), new AbortController().signal)
    await Promise.resolve(); await Promise.resolve()
    MockXHR.last.onerror?.()
    await expect(pending).rejects.toThrow('Connection interrupted')
    await expect(uploadFile(new FormData(), 'other', vi.fn(), vi.fn(), new AbortController().signal)).rejects.toThrow('account changed')
  })
  test('aborts in-flight transfers when the session ends', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR)
    const controller = new AbortController()
    const pending = uploadFile(new FormData(), 'owner', vi.fn(), vi.fn(), controller.signal)
    await Promise.resolve(); await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

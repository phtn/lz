import { getCurrentUser } from './firebase'
import type { StoredFile } from '@/types/file'

export type TransferProgress = { percent: number; loaded: number; total: number; bytesPerSecond: number }

// Fetch has no portable upstream progress events. XHR reports bytes actually sent.
export async function uploadFile(
  form: FormData,
  ownerUid: string,
  onProgress: (progress: TransferProgress) => void,
  onSent: () => void,
  signal: AbortSignal
): Promise<StoredFile> {
  const user = getCurrentUser()
  if (!user || user.uid !== ownerUid) throw new Error('Your account changed. Add this file again after signing in.')
  const token = await user.getIdToken()
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastTime = performance.now()
    let lastLoaded = 0
    const cleanup = () => signal.removeEventListener('abort', abort)
    const abort = () => xhr.abort()
    xhr.open('POST', '/api/files')
    xhr.setRequestHeader('authorization', `Bearer ${token}`)
    xhr.responseType = 'json'
    xhr.timeout = 10 * 60 * 1000
    xhr.upload.onprogress = (event) => {
      const now = performance.now()
      if (now - lastTime < 120 && event.loaded !== event.total) return
      const bytesPerSecond = (event.loaded - lastLoaded) / Math.max((now - lastTime) / 1000, 0.001)
      lastTime = now
      lastLoaded = event.loaded
      onProgress({ percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0, loaded: event.loaded, total: event.total, bytesPerSecond })
    }
    xhr.upload.onload = onSent
    xhr.onload = () => {
      cleanup()
      const payload = xhr.response as { file?: StoredFile; error?: string } | null
      if (xhr.status < 200 || xhr.status >= 300 || !payload?.file) {
        reject(new Error(payload?.error ?? 'The file could not be saved. Please retry.'))
      } else resolve(payload.file)
    }
    xhr.onerror = () => { cleanup(); reject(new Error('Connection interrupted. Check your connection and retry.')) }
    xhr.ontimeout = () => { cleanup(); reject(new Error('Upload timed out. Please retry.')) }
    xhr.onabort = () => { cleanup(); reject(new DOMException('Upload stopped', 'AbortError')) }
    signal.addEventListener('abort', abort, { once: true })
    xhr.send(form)
  })
}

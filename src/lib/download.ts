import { authenticatedFetch } from './firebase'

export async function downloadOriginal(id: string, name: string, signal: AbortSignal) {
  const response = await authenticatedFetch(`/api/files/${encodeURIComponent(id)}?download=1`, { signal })
  if (!response.ok) {
    const text = await response.text()
    let message = text
    try { message = (JSON.parse(text) as { error?: string }).error ?? text } catch { /* Storage errors can be plain text. */ }
    throw new Error(response.status === 404
      ? 'The original file could not be found in cloud storage. Please upload it again.'
      : message && message.length < 300 && !message.includes('<') ? message : 'The file could not be downloaded. Please try again.')
  }
  const blob = await response.blob()
  if (signal.aborted) throw new DOMException('Download cancelled.', 'AbortError')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give browsers time to consume the blob before releasing its bytes.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

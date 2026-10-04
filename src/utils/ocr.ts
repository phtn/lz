import type { Worker } from 'tesseract.js'
import { TEXT_EXTENSIONS } from '@/constants/meta'
import type { Classification } from '@/types/file'
import { classifyText, fileExtension, inferFromName } from './helpers'

const MAX_TEXT = 60000
const MAX_PAGES = 12
const MAX_EDGE = 2400
export type AnalysisProgress = (progress: number, detail: string) => void
let worker: Worker | null = null
let workerLanguage = ''
let progressListener: AnalysisProgress = () => {}
let idleTimer: ReturnType<typeof setTimeout> | undefined
let recognitionTail: Promise<unknown> = Promise.resolve()

async function recognize(canvas: HTMLCanvasElement, language: string, onProgress: AnalysisProgress) {
  // One reusable worker keeps multiple large OCR engines out of mobile memory.
  const run = async () => {
    clearTimeout(idleTimer)
    progressListener = onProgress
    if (worker && workerLanguage !== language) { await worker.terminate(); worker = null }
    if (!worker) {
      onProgress(3, 'Preparing the private OCR engine…')
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker(language, 1, { logger: (message) => {
        progressListener(message.status === 'recognizing text' ? Math.round(message.progress * 100) : 3,
          message.status === 'recognizing text' ? 'Recognizing text on this device…' : 'Loading OCR language data…')
      } })
      workerLanguage = language
      await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' })
    }
    try {
      const result = await worker.recognize(canvas, { rotateAuto: true }, { text: true })
      return { text: result.data.text, confidence: result.data.confidence }
    } catch (error) {
      await worker?.terminate().catch(() => {})
      worker = null
      throw error
    } finally {
      progressListener = () => {}
      idleTimer = setTimeout(() => { const idle = worker; worker = null; void idle?.terminate() }, 45000)
    }
  }
  const pending = recognitionTail.then(run, run)
  recognitionTail = pending.catch(() => {})
  return pending
}

function prepareCanvas(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(MAX_EDGE / Math.max(width, height), Math.max(1, 1400 / Math.max(width, height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Image processing is unavailable in this browser.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2]
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.18 + 128))
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = contrasted
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

async function imageCanvas(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return prepareCanvas(image, image.naturalWidth, image.naturalHeight)
  } finally { URL.revokeObjectURL(url) }
}

async function extractPdf(file: File, language: string, onProgress: AnalysisProgress) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const chunks: string[] = []
  const confidences: number[] = []
  let pagesRead = 0
  let warning: string | undefined
  try {
    const pdf = await task.promise
    const pageCount = pdf.numPages
    const limit = Math.min(pageCount, MAX_PAGES)
    for (let index = 1; index <= limit; index++) {
      const page = await pdf.getPage(index)
      try {
        const content = await page.getTextContent()
        let text = content.items.map((item) => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim()
        if (text.replace(/\s/g, '').length < 40) {
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: Math.min(2, MAX_EDGE / Math.max(base.width, base.height)) })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext('2d', { alpha: false })
          if (!context) throw new Error('PDF rendering unavailable.')
          try {
            await page.render({ canvas, canvasContext: context, viewport }).promise
            const result = await recognize(canvas, language, (progress) => onProgress(
              ((index - 1 + progress / 100) / limit) * 100, `Reading scanned page ${index} of ${limit}…`))
            if (result.text.trim()) text = result.text
            confidences.push(result.confidence)
          } finally { canvas.width = canvas.height = 0 }
        }
        chunks.push(`[Page ${index}]\n${text}`)
        pagesRead++
      } catch {
        warning = 'Some pages could not be read. Review the original file.'
      } finally { page.cleanup() }
      onProgress(index / limit * 100, `Read ${index} of ${limit} pages`)
    }
    if (pageCount > limit) warning = `Read the first ${limit} of ${pageCount} pages to keep processing fast. The complete original is saved.`
    return { text: chunks.join('\n\n').slice(0, MAX_TEXT), pagesRead, pageCount, warning,
      method: confidences.length ? 'PDF text + on-device OCR' : 'PDF text extraction',
      ocrConfidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : undefined }
  } finally { await task.destroy() }
}

async function extractOffice(file: File) {
  const { unzipSync } = await import('fflate')
  // Bound decompression before touching any XML, including zip bombs.
  let total = 0
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => {
    const allowed = /^(word\/document|ppt\/slides\/slide\d+|xl\/(sharedStrings|worksheets\/sheet\d+))\.xml$/.test(entry.name)
    if (!allowed) return false
    total += entry.originalSize
    if (total > 16 * 1024 * 1024) throw new Error('Document text is too large for local extraction.')
    return true
  } })
  return Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([, bytes]) => {
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')
    return Array.from(xml.getElementsByTagName('*')).filter((node) => ['t', 'v'].includes(node.localName))
      .map((node) => node.textContent ?? '').join(' ')
  }).join('\n').slice(0, MAX_TEXT)
}

export async function analyzeFile(file: File, onProgress: AnalysisProgress, language = 'eng'): Promise<Classification> {
  const extension = fileExtension(file.name)
  let extracted: Partial<Classification> & { text?: string } = {}
  try {
    onProgress(0, 'Inspecting file contents…')
    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif'].includes(extension)) {
      const canvas = await imageCanvas(file)
      try {
        const result = await recognize(canvas, language, onProgress)
        extracted = { text: result.text.slice(0, MAX_TEXT), ocrConfidence: Math.round(result.confidence), method: 'On-device OCR' }
      } finally { canvas.width = canvas.height = 0 }
    } else if (extension === 'pdf' || file.type === 'application/pdf') {
      extracted = await extractPdf(file, language, onProgress)
    } else if (['docx', 'pptx', 'xlsx'].includes(extension)) {
      extracted = { text: await extractOffice(file), method: 'Office document text extraction' }
    } else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extension) || extension === 'eml') {
      extracted = { text: await file.slice(0, 256 * 1024).text(), method: 'Local text analysis' }
    }
    const text = extracted.text?.trim().slice(0, MAX_TEXT) ?? ''
    // Avoid assigning business folders to source code just because it contains common keywords.
    const classification = fileKindIsCode(file) ? inferFromName(file) : text ? classifyText(text, file) : inferFromName(file)
    onProgress(100, 'Analysis complete')
    return { ...classification, ...extracted, text, method: extracted.method ?? classification.method,
      warning: extracted.warning ?? (extracted.ocrConfidence !== undefined && extracted.ocrConfidence < 60
        ? 'Text recognition confidence is low. Review the extracted text and folder.' : undefined) }
  } catch {
    onProgress(100, 'Using the filename and file type')
    return { ...inferFromName(file), warning: 'Text extraction was unavailable. Filed using the filename and file type; review the original.' }
  }
}

function fileKindIsCode(file: File) {
  return ['btsx', 'tsrx', 'js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'html', 'css', 'json', 'gleam', 'vue', 'svelte'].includes(fileExtension(file.name))
}

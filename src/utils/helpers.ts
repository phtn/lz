import { CATEGORY_RULES, TEXT_EXTENSIONS, categoryFromFileType } from '@/constants/meta'
import type { IconName } from '@/types/icon'
import type { CategoryRule, Classification } from '@/types/file'

export function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function fileKind(name: string, mimeType: string) {
  const extension = fileExtension(name)
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg', 'bmp', 'tif', 'tiff', 'avif'].includes(extension)) return 'Image'
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'PDF'
  if (['csv', 'tsv', 'xls', 'xlsx', 'ods', 'numbers'].includes(extension)) return 'Spreadsheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(extension)) return 'Presentation'
  if (['doc', 'docx', 'odt', 'rtf', 'pages', 'epub', 'mobi'].includes(extension)) return 'Document'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(extension)) return 'Archive'
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(extension)) return 'Audio'
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(extension)) return 'Video'
  if (
    ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'json', 'xml', 'yaml',
      'yml', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php',
      'sh', 'sql'].includes(extension)
  ) return 'Code file'
  if (TEXT_EXTENSIONS.has(extension)) return 'Text file'
  return extension ? `${extension.toUpperCase()} file` : 'File'
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function truncate(value: string, length: number) {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > length ? `${compact.slice(0, length).trim()}…` : compact
}

export function getFileIcon(name: string, mimeType: string): IconName {
  const extension = fileExtension(name)
  if (mimeType.startsWith('image/')) return 'image'
  if (['csv', 'xls', 'xlsx'].includes(extension)) return 'table'
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'file-pdf'
  return 'file'
}

export function inferFromName(file: File): Classification {
  const result = classifyText('', file)
  return {
    ...result,
    confidence: Math.min(result.confidence, 74),
    method: 'File type + filename'
  }
}

function countMatches(value: string, pattern: RegExp | undefined) {
  return pattern ? value.match(pattern)?.length ?? 0 : 0
}

export function classifyText(text: string, file: File): Classification {
  const filename = file.name.replace(/[_.-]+/g, ' ')
  const content = text.replace(/\s+/g, ' ').trim()
  let best: { rule: CategoryRule; score: number; strongMatches: number } | null = null

  for (const rule of CATEGORY_RULES) {
    const strongMatches = countMatches(content, rule.strongTerms)
    const regularMatches = countMatches(content, rule.terms)
    const filenameMatches =
      countMatches(filename, rule.strongTerms) + countMatches(filename, rule.terms)
    const score = strongMatches * 4 + regularMatches + filenameMatches * 3

    if (!best || score > best.score || (score === best.score && strongMatches > best.strongMatches)) {
      best = { rule, score, strongMatches }
    }
  }

  const fallbackKind = fileKind(file.name, file.type)
  if (!best || best.score === 0) {
    return {
      category: categoryFromFileType(file.name, file.type),
      kind: fallbackKind,
      confidence: content.length > 30 ? 64 : 58,
      excerpt: truncate(text, 150),
      method: content ? 'Content + file type analysis' : 'File type + filename'
    }
  }

  return {
    category: best.rule.category,
    kind: best.rule.kind,
    confidence: Math.min(97, 69 + best.score * 3 + (content.length > 120 ? 4 : 0)),
    excerpt: truncate(text, 150),
    method: 'Smart local content analysis'
  }
}

async function recognizeImage(image: File | HTMLCanvasElement, onProgress: (progress: number) => void) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress(Math.max(8, Math.round(message.progress * 84)))
    }
  })

  try {
    const result = await worker.recognize(image)
    return result.data.text
  } finally {
    await worker.terminate()
  }
}

async function extractPdfText(file: File, onProgress: (progress: number) => void) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'

  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const pagesToRead = Math.min(pdf.numPages, 3)
  const chunks: string[] = []

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    chunks.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    onProgress(Math.round((pageNumber / pagesToRead) * 75))
  }

  const extractedText = chunks.join('\n').trim()
  if (extractedText.length > 80) return extractedText

  const firstPage = await pdf.getPage(1)
  const viewport = firstPage.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return extractedText

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await firstPage.render({ canvas, canvasContext: context, viewport }).promise
  const ocrText = await recognizeImage(canvas, onProgress)
  return `${extractedText}\n${ocrText}`.trim()
}

export async function analyzeFile(file: File, onProgress: (progress: number) => void) {
  const extension = fileExtension(file.name)
  let text = ''
  let method = 'File type + filename'

  if (file.type.startsWith('image/')) {
    text = await recognizeImage(file, onProgress)
    method = 'On-device OCR'
  } else if (file.type === 'application/pdf' || extension === 'pdf') {
    text = await extractPdfText(file, onProgress)
    method = text.length > 80 ? 'Local PDF text + OCR' : method
  } else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
    text = await file.text()
    onProgress(88)
    method = 'Local text analysis'
  }

  if (!text.trim()) return inferFromName(file)
  return { ...classifyText(text, file), method }
}

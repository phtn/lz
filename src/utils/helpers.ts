import { CATEGORY_RULES, TEXT_EXTENSIONS, categoryFromFileType } from '@/constants/meta'
import type { IconName } from '@/lib/icons/icons'
import type { CategoryRule, Classification } from '@/types/file'

export function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function fileKind(name: string, mimeType: string) {
  const extension = fileExtension(name)
  if (mimeType.startsWith('image/') || ['heif', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg', 'bmp', 'tif', 'tiff', 'avif'].includes(extension)) return 'Image'
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'PDF'
  if (['csv', 'tsv', 'xls', 'xlsx', 'ods', 'numbers'].includes(extension)) return 'Spreadsheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(extension)) return 'Presentation'
  if (['doc', 'docx', 'odt', 'rtf', 'pages', 'epub', 'mobi'].includes(extension)) return 'Document'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(extension)) return 'Archive'
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'].includes(extension)) return 'Audio'
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(extension)) return 'Video'
  if (
    ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'json', 'xml', 'yaml',
      'yml', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php',
      'sh', 'sql'].includes(extension)
  ) return 'Code file'
  if (categoryFromFileType(name, mimeType) === 'Code') return 'Code file'
  if (['eml', 'msg'].includes(extension)) return 'Email'
  if (categoryFromFileType(name, mimeType) === 'Design') return 'Design file'
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
  return pattern ? new Set((value.match(pattern) ?? []).map((match) => match.toLowerCase())).size : 0
}

export function classifyText(text: string, file: File): Classification {
  if (categoryFromFileType(file.name, file.type) === 'Code') return { category: 'Code', kind: 'Code file', confidence: 98, excerpt: truncate(text, 300), method: 'File type analysis' }
  const filename = file.name.replace(/[_.-]+/g, ' ')
  const content = text.normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().slice(0, 60000)
  let best: { rule: CategoryRule; score: number; strongMatches: number } | null = null

  for (const rule of CATEGORY_RULES) {
    const strongMatches = countMatches(content, rule.strongTerms)
    const regularMatches = countMatches(content, rule.terms)
    const filenameMatches =
      countMatches(filename, rule.strongTerms) + countMatches(filename, rule.terms)
    if (!strongMatches && !filenameMatches && regularMatches < 2) continue
    const score = strongMatches * 6 + regularMatches + filenameMatches * 5

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
      excerpt: truncate(text, 300),
      method: content ? 'Content + file type analysis' : 'File type + filename'
    }
  }

  return {
    category: best.rule.category,
    kind: best.rule.kind,
    confidence: Math.min(97, 69 + best.score * 3 + (content.length > 120 ? 4 : 0)),
    excerpt: truncate(text, 300),
    method: 'Smart local content analysis'
  }
}

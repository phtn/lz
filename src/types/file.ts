export type QueueStatus = 'queued' | 'reading' | 'classifying' | 'uploading' | 'done' | 'error'

export type CategoryName =
  | 'Receipts'
  | 'Finance'
  | 'Legal'
  | 'Identity'
  | 'Medical'
  | 'Travel'
  | 'Work'
  | 'Personal'
  | 'Education'
  | 'Insurance'
  | 'PDFs'
  | 'Documents'
  | 'Spreadsheets'
  | 'Presentations'
  | 'Images'
  | 'Archives'
  | 'Media'
  | 'Code'
  | 'All'

export type Classification = {
  category: CategoryName
  kind: string
  confidence: number
  excerpt: string
  method: string
}

export type QueueItem = {
  id: string
  file: File
  status: QueueStatus
  progress: number
  previewUrl?: string
  classification?: Classification
  error?: string
}

export type StoredFile = {
  id: string
  name: string
  size: number
  mimeType: string
  category: CategoryName
  kind: string
  confidence: number
  excerpt: string
  objectKey: string
  createdAt: string
}

export type CategoryRule = {
  category: CategoryName
  kind: string
  terms: RegExp
  strongTerms?: RegExp
}

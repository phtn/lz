export type QueueStatus = 'queued' | 'reading' | 'classifying' | 'uploading' | 'filing' | 'done' | 'error'

export type CategoryName =
  | 'Receipts'
  | 'Finance'
  | 'Investments'
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
  | 'Invoices'
  | 'Taxes'
  | 'Banking'
  | 'Employment'
  | 'Property'
  | 'Research'
  | 'Design'
  | 'Emails'
  | 'Audio'
  | 'Video'
  | 'All'

export type JevAssessment = {
  status: 'accepted' | 'review' | 'unavailable' | 'skipped' | 'corrected'
  policyVersion: string
  reason: string
  model?: string
  suggestedCategory?: Exclude<CategoryName, 'All'> | 'Unknown'
  confidence?: number
  probability?: number
  margin?: number
  evidenceProbability?: number
  probabilities?: Record<string, number>
  reviewedAt?: number
}

export type Classification = {
  category: CategoryName
  kind: string
  confidence: number
  excerpt: string
  method: string
  text?: string
  ocrConfidence?: number
  pagesRead?: number
  pageCount?: number
  warning?: string
  jev?: JevAssessment
}

export type QueueItem = {
  id: string
  file: File
  status: QueueStatus
  progress: number
  previewUrl?: string
  classification?: Classification
  error?: string
  detail?: string
  uploadedBytes?: number
  totalBytes?: number
  bytesPerSecond?: number
  storedFile?: StoredFile
  language?: string
  ownerUid: string
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
  createdAt: string
  url: string
  thumbnailUrl?: string
  method?: string
  text?: string
  ocrConfidence?: number
  pagesRead?: number
  pageCount?: number
  warning?: string
  jev?: JevAssessment
}

export type CategoryRule = {
  category: CategoryName
  kind: string
  terms: RegExp
  strongTerms?: RegExp
}

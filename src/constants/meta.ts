import type { CategoryName, CategoryRule, QueueStatus, StoredFile } from '@/types/file'

export const CATEGORY_NAMES: StoredFile['category'][] = [
  'Receipts',
  'Finance',
  'Legal',
  'Identity',
  'Medical',
  'Travel',
  'Work',
  'Personal',
  'Education',
  'Insurance',
  'PDFs',
  'Documents',
  'Spreadsheets',
  'Presentations',
  'Images',
  'Archives',
  'Media',
  'Code'
]

export const CATEGORY_META: Record<CategoryName, { color: string; background: string }> = {
  Receipts: { color: '#a44b14', background: '#fff0df' },
  Finance: { color: '#3f6d51', background: '#eaf5eb' },
  Legal: { color: '#76562b', background: '#f5eedf' },
  Identity: { color: '#4b5b9b', background: '#edf0ff' },
  Medical: { color: '#9a4661', background: '#faeaf0' },
  Travel: { color: '#287086', background: '#e7f5f8' },
  Work: { color: '#7851a9', background: '#f1ebfa' },
  Personal: { color: '#816638', background: '#f7f0df' },
  Education: { color: '#496b31', background: '#edf5e7' },
  Insurance: { color: '#596479', background: '#edf0f5' },
  PDFs: { color: '#a13d3d', background: '#faeaea' },
  Documents: { color: '#4d6685', background: '#eaf0f7' },
  Spreadsheets: { color: '#347152', background: '#e6f4ec' },
  Presentations: { color: '#a0542c', background: '#faeee6' },
  Images: { color: '#8a4f83', background: '#f7eaf5' },
  Archives: { color: '#6c6255', background: '#f1eee9' },
  Media: { color: '#426c79', background: '#e8f3f5' },
  Code: { color: '#555a92', background: '#eceefa' },
  All: { color: '#5f625e', background: '#eceeeb' }
}

export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'html', 'htm', 'log', 'rtf',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'sql'
])

const SPREADSHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods', 'numbers'])
const PRESENTATION_EXTENSIONS = new Set(['ppt', 'pptx', 'odp', 'key'])
const DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages', 'epub', 'mobi'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp', 'tif', 'tiff', 'avif'])
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'])
const MEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'])
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'json', 'xml', 'yaml',
  'yml', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php',
  'sh', 'sql'
])

export function categoryFromFileType(name: string, mimeType: string): Exclude<CategoryName, 'All'> {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  const mime = mimeType.toLowerCase()

  if (mime === 'application/pdf' || extension === 'pdf') return 'PDFs'
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'Images'
  if (SPREADSHEET_EXTENSIONS.has(extension) || /spreadsheet|excel|csv/.test(mime)) return 'Spreadsheets'
  if (PRESENTATION_EXTENSIONS.has(extension) || /presentation|powerpoint/.test(mime)) return 'Presentations'
  if (ARCHIVE_EXTENSIONS.has(extension) || /zip|compressed|archive|tar/.test(mime)) return 'Archives'
  if (mime.startsWith('audio/') || mime.startsWith('video/') || MEDIA_EXTENSIONS.has(extension)) return 'Media'
  if (CODE_EXTENSIONS.has(extension)) return 'Code'
  if (DOCUMENT_EXTENSIONS.has(extension) || mime.startsWith('text/') || /word|document|ebook/.test(mime)) return 'Documents'
  return 'Documents'
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Receipts',
    kind: 'Receipt',
    strongTerms: /\b(receipt|subtotal|cashier|change due|thank you for your purchase|merchant copy|order total)\b/gi,
    terms: /\b(total|amount due|payment method|vat|tax|card|purchase|quantity|qty)\b/gi
  },
  {
    category: 'Finance',
    kind: 'Invoice',
    strongTerms: /\b(invoice|bill to|invoice number|invoice date|payment due|remit to)\b/gi,
    terms: /\b(amount due|line item|unit price|billing|payment terms|purchase order)\b/gi
  },
  {
    category: 'Finance',
    kind: 'Bank statement',
    strongTerms: /\b(bank statement|account statement|opening balance|closing balance|available balance)\b/gi,
    terms: /\b(account number|deposit|withdrawal|transaction|credit|debit|interest|balance)\b/gi
  },
  {
    category: 'Finance',
    kind: 'Tax or payroll document',
    strongTerms: /\b(tax return|tax form|payslip|pay stub|payroll|withholding|gross pay|net pay)\b/gi,
    terms: /\b(tax|salary|income|deduction|employer|employee|fiscal year)\b/gi
  },
  {
    category: 'Legal',
    kind: 'Contract or legal document',
    strongTerms: /\b(agreement|contract|affidavit|deed|lease agreement|power of attorney|non-disclosure agreement|terms and conditions)\b/gi,
    terms: /\b(party|hereby|witnesseth|liability|confidential|governing law|signature|executed)\b/gi
  },
  {
    category: 'Identity',
    kind: 'Identity document',
    strongTerms: /\b(passport|driver'?s licen[cs]e|national id|identity card|social security|birth certificate)\b/gi,
    terms: /\b(date of birth|place of birth|citizenship|nationality|surname|given name|document number|sex)\b/gi
  },
  {
    category: 'Medical',
    kind: 'Medical record',
    strongTerms: /\b(prescription|medical record|laboratory result|lab result|discharge summary|diagnosis|radiology)\b/gi,
    terms: /\b(patient|physician|doctor|clinic|hospital|dosage|medication|specimen|treatment|symptoms)\b/gi
  },
  {
    category: 'Travel',
    kind: 'Travel document',
    strongTerms: /\b(boarding pass|flight itinerary|booking confirmation|hotel reservation|e-ticket|travel itinerary)\b/gi,
    terms: /\b(flight|booking|reservation|departure|arrival|hotel|itinerary|gate|seat|passenger|check-in)\b/gi
  },
  {
    category: 'Work',
    kind: 'Resume or CV',
    strongTerms: /\b(curriculum vitae|professional experience|work experience|employment history|career summary)\b/gi,
    terms: /\b(resume|skills|education|experience|references|portfolio|linkedin)\b/gi
  },
  {
    category: 'Work',
    kind: 'Work document',
    strongTerms: /\b(project proposal|meeting minutes|meeting agenda|quarterly report|business plan|statement of work)\b/gi,
    terms: /\b(project|proposal|meeting|agenda|minutes|quarterly|client|deliverable|roadmap|report|deadline)\b/gi
  },
  {
    category: 'Personal',
    kind: 'Personal document',
    strongTerms: /\b(personal letter|wedding invitation|birthday invitation|family record|personal journal)\b/gi,
    terms: /\b(family|personal|invitation|letter|dear|sincerely|anniversary)\b/gi
  },
  {
    category: 'Education',
    kind: 'Education document',
    strongTerms: /\b(transcript|report card|diploma|degree certificate|course syllabus|certificate of completion|student record)\b/gi,
    terms: /\b(student|school|university|college|course|grade|semester|academic|enrollment|tuition)\b/gi
  },
  {
    category: 'Insurance',
    kind: 'Insurance document',
    strongTerms: /\b(insurance policy|policy number|certificate of insurance|insurance claim|coverage summary)\b/gi,
    terms: /\b(insured|insurer|premium|coverage|beneficiary|deductible|claim|policyholder)\b/gi
  }
]

export const STATUS_COPY: Record<QueueStatus, string> = {
  queued: 'Waiting in queue',
  reading: 'Reading contents locally',
  classifying: 'Choosing the best folder',
  uploading: 'Saving to your local library',
  done: 'Filed and ready',
  error: 'Needs attention'
}

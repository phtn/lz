import type { CategoryName, CategoryRule, QueueStatus } from '@/types/file'
import type { IconName } from '@/lib/icons'

// Temporarily expose empty folders while reviewing the category palette.
export const SHOW_EMPTY_FOLDERS = true

export const CATEGORY_NAMES: Exclude<CategoryName, 'All'>[] = [
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
  'Code', 'Invoices', 'Taxes', 'Banking', 'Employment', 'Property', 'Research', 'Design', 'Emails', 'Audio', 'Video'
]

export const CATEGORY_META: Record<CategoryName, { color: string; background: string; iconClass: string }> = {
  Receipts: { color: '#a44b14', background: '#fff0df', iconClass: 'text-orange-600 dark:text-orange-400' },
  Finance: { color: '#3f6d51', background: '#eaf5eb', iconClass: 'text-green-600 dark:text-green-400' },
  Legal: { color: '#76562b', background: '#f5eedf', iconClass: 'text-amber-600 dark:text-amber-400' },
  Identity: { color: '#4b5b9b', background: '#edf0ff', iconClass: 'text-indigo-600 dark:text-indigo-400' },
  Medical: { color: '#9a4661', background: '#faeaf0', iconClass: 'text-rose-600 dark:text-rose-400' },
  Travel: { color: '#287086', background: '#e7f5f8', iconClass: 'text-cyan-600 dark:text-cyan-400' },
  Work: { color: '#7851a9', background: '#f1ebfa', iconClass: 'text-violet-600 dark:text-violet-400' },
  Personal: { color: '#816638', background: '#f7f0df', iconClass: 'text-yellow-600 dark:text-yellow-400' },
  Education: { color: '#496b31', background: '#edf5e7', iconClass: 'text-lime-600 dark:text-lime-400' },
  Insurance: { color: '#596479', background: '#edf0f5', iconClass: 'text-slate-600 dark:text-slate-400' },
  PDFs: { color: '#a13d3d', background: '#faeaea', iconClass: 'text-red-600 dark:text-red-400' },
  Documents: { color: '#4d6685', background: '#eaf0f7', iconClass: 'text-blue-600 dark:text-blue-400' },
  Spreadsheets: { color: '#347152', background: '#e6f4ec', iconClass: 'text-emerald-600 dark:text-emerald-400' },
  Presentations: { color: '#a0542c', background: '#faeee6', iconClass: 'text-orange-600 dark:text-orange-400' },
  Images: { color: '#8a4f83', background: '#f7eaf5', iconClass: 'text-fuchsia-600 dark:text-fuchsia-400' },
  Archives: { color: '#6c6255', background: '#f1eee9', iconClass: 'text-stone-600 dark:text-stone-400' },
  Media: { color: '#426c79', background: '#e8f3f5', iconClass: 'text-teal-600 dark:text-teal-400' },
  Code: { color: '#555a92', background: '#eceefa', iconClass: 'text-indigo-600 dark:text-indigo-400' },
  Invoices: { color: '#956311', background: '#fff3d6', iconClass: 'text-amber-600 dark:text-amber-400' },
  Taxes: { color: '#8b572a', background: '#f9eddf', iconClass: 'text-orange-600 dark:text-orange-400' },
  Banking: { color: '#28725d', background: '#e2f5ed', iconClass: 'text-emerald-600 dark:text-emerald-400' },
  Employment: { color: '#7651a2', background: '#f0eafa', iconClass: 'text-purple-600 dark:text-purple-400' },
  Property: { color: '#9a5c3a', background: '#f9ece4', iconClass: 'text-orange-600 dark:text-orange-400' },
  Research: { color: '#316b8e', background: '#e8f3fa', iconClass: 'text-sky-600 dark:text-sky-400' },
  Design: { color: '#a04586', background: '#fae9f5', iconClass: 'text-pink-600 dark:text-pink-400' },
  Emails: { color: '#5564a3', background: '#eef0fc', iconClass: 'text-blue-600 dark:text-blue-400' },
  Audio: { color: '#7e54a0', background: '#f1eaf8', iconClass: 'text-violet-600 dark:text-violet-400' },
  Video: { color: '#38757f', background: '#e7f5f7', iconClass: 'text-cyan-600 dark:text-cyan-400' },
  All: { color: '#5f625e', background: '#eceeeb', iconClass: 'text-slate-600 dark:text-slate-400' }
}

export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'html', 'htm', 'log', 'rtf',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'sql', 'btsx', 'tsrx', 'gleam', 'toml', 'ini', 'svelte', 'vue', 'swift', 'dart', 'ex', 'exs', 'ipynb'
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
  'sh', 'sql', 'btsx', 'tsrx', 'gleam', 'toml', 'ini', 'svelte', 'vue', 'swift', 'dart', 'ex', 'exs', 'ipynb'
])

export function categoryFromFileType(name: string, mimeType: string): Exclude<CategoryName, 'All'> {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  const mime = mimeType.toLowerCase()

  if (mime === 'application/pdf' || extension === 'pdf') return 'PDFs'
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'Images'
  if (SPREADSHEET_EXTENSIONS.has(extension) || /spreadsheet|excel|csv/.test(mime)) return 'Spreadsheets'
  if (PRESENTATION_EXTENSIONS.has(extension) || /presentation|powerpoint/.test(mime)) return 'Presentations'
  if (ARCHIVE_EXTENSIONS.has(extension) || /zip|compressed|archive|tar/.test(mime)) return 'Archives'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'].includes(extension)) return 'Audio'
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(extension)) return 'Video'
  if (['eml', 'msg'].includes(extension)) return 'Emails'
  if (['psd', 'ai', 'eps', 'sketch', 'fig', 'xd', 'indd', 'blend', 'dwg', 'dxf'].includes(extension)) return 'Design'
  if (MEDIA_EXTENSIONS.has(extension)) return 'Media'
  if (CODE_EXTENSIONS.has(extension)) return 'Code'
  if (DOCUMENT_EXTENSIONS.has(extension) || mime.startsWith('text/') || /word|document|ebook/.test(mime)) return 'Documents'
  return 'Documents'
}

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Taxes', kind: 'Tax document', strongTerms: /\b(tax return|tax form|withholding tax|income tax|bir form|w[ -]?2|1099|itr)\b/gi, terms: /\b(taxpayer|taxable|deduction|fiscal year|assessment)\b/gi },
  { category: 'Property', kind: 'Property record', strongTerms: /\b(property deed|land title|real estate|mortgage|tenancy agreement|property tax|lease agreement)\b/gi, terms: /\b(landlord|tenant|parcel|property|rent|premises)\b/gi },
  { category: 'Research', kind: 'Research paper', strongTerms: /\b(research paper|abstract|literature review|methodology|peer reviewed|doi)\b/gi, terms: /\b(hypothesis|findings|bibliography|citations|experiment|research)\b/gi },
  { category: 'Design', kind: 'Creative brief', strongTerms: /\b(creative brief|brand guidelines|design system|moodboard|wireframe|style guide)\b/gi, terms: /\b(typography|palette|logo|branding|artwork|design)\b/gi },
  { category: 'Finance', kind: 'Financial report', strongTerms: /\b(financial report|balance sheet|income statement|profit and loss|cash flow)\b/gi, terms: /\b(assets|liabilities|equity|revenue|expenses)\b/gi },
  {
    category: 'Receipts',
    kind: 'Receipt',
    strongTerms: /\b(receipt|subtotal|cashier|change due|thank you for your purchase|merchant copy|order total)\b/gi,
    terms: /\b(total|amount due|payment method|vat|tax|card|purchase|quantity|qty)\b/gi
  },
  {
    category: 'Invoices',
    kind: 'Invoice',
    strongTerms: /\b(invoice|bill to|invoice number|invoice date|payment due|remit to)\b/gi,
    terms: /\b(amount due|line item|unit price|billing|payment terms|purchase order)\b/gi
  },
  {
    category: 'Banking',
    kind: 'Bank statement',
    strongTerms: /\b(bank statement|account statement|opening balance|closing balance|available balance)\b/gi,
    terms: /\b(account number|deposit|withdrawal|transaction|credit|debit|interest|balance)\b/gi
  },
  {
    category: 'Employment',
    kind: 'Payroll document',
    strongTerms: /\b(payslip|pay stub|payroll|gross pay|net pay|offer letter|certificate of employment)\b/gi,
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
    category: 'Employment',
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
  uploading: 'Uploading to the cloud',
  filing: 'Upload sent · confirming cloud storage',
  done: 'Sorted, filed & ready to view',
  error: 'Needs attention'
}

export const CATEGORY_GROUPS: { label: string; icon: IconName; categories: Exclude<CategoryName, 'All'>[] }[] = [
  { label: 'Finance & admin', icon: 'performance', categories: ['Receipts', 'Invoices', 'Banking', 'Taxes', 'Finance', 'Insurance'] },
  { label: 'Personal records', icon: 'person', categories: ['Identity', 'Medical', 'Travel', 'Personal', 'Property'] },
  { label: 'Work & study', icon: 'bookmark', categories: ['Work', 'Employment', 'Legal', 'Education', 'Research'] },
  { label: 'Documents & mail', icon: 'files', categories: ['PDFs', 'Documents', 'Spreadsheets', 'Presentations', 'Emails'] },
  { label: 'Creative & media', icon: 'canvas', categories: ['Images', 'Design', 'Audio', 'Video', 'Media'] },
  { label: 'Archives & code', icon: 'server', categories: ['Archives', 'Code'] }
]
export const OCR_LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'eng+spa', label: 'English + Spanish' },
  { value: 'eng+fra', label: 'English + French' },
  { value: 'eng+deu', label: 'English + German' },
  { value: 'eng+chi_sim', label: 'English + Chinese' },
  { value: 'eng+jpn', label: 'English + Japanese' }
]
export const MAX_FILE_SIZE = 20 * 1024 * 1024

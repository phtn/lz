import { describe, expect, test } from 'vitest'
import { classifyText, fileKind } from '../../src/utils/helpers'
import { categoryFromFileType } from '../../src/constants/meta'
const file = (name = 'scan.png', type = 'image/png') => new File(['contents'], name, { type })
describe('classification', () => {
  test.each([
    ['RECEIPT Subtotal 10.00 Cashier Total 11.00', 'Receipts', 'Receipt'],
    ['Invoice number 456 Bill to Acme Payment terms 30 days', 'Invoices', 'Invoice'],
    ['Bank statement Opening balance Closing balance Deposit', 'Banking', 'Bank statement'],
    ['BIR form Income tax return taxpayer taxable income', 'Taxes', 'Tax document'],
    ['Pay stub Payroll Gross pay Net pay Employee', 'Employment', 'Payroll document'],
    ['Land title Property deed landlord parcel premises', 'Property', 'Property record'],
    ['Research paper Abstract Methodology Literature review', 'Research', 'Research paper'],
    ['Brand guidelines Creative brief Typography Palette', 'Design', 'Creative brief']
  ])('recognizes %s', (text, category, kind) => {
    expect(classifyText(text, file())).toMatchObject({ category, kind })
  })
  test('a repeated generic word does not overpower the file type', () => {
    expect(classifyText('total '.repeat(100), file()).category).toBe('Images')
  })
  test('recognizes filenames and modern media/code formats', () => {
    expect(classifyText('', file('invoice-2026.pdf', 'application/pdf')).category).toBe('Invoices')
    expect(categoryFromFileType('voice.opus', '')).toBe('Audio')
    expect(categoryFromFileType('clip.webm', '')).toBe('Video')
    expect(categoryFromFileType('Component.btsx', '')).toBe('Code')
    expect(fileKind('main.gleam', '')).toBe('Code file')
    expect(categoryFromFileType('message.eml', '')).toBe('Emails')
  })
})

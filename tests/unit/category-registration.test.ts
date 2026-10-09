import { expect, test } from 'vitest'
import { CATEGORY_GROUPS, CATEGORY_NAMES } from '@/constants/meta'
import { getFolderCategory, getWorkspaceNavGroups } from '@/lib/navs'
import type { CategoryName } from '@/types/file'

test('every grouped category is registered for navigation', () => {
  for (const group of CATEGORY_GROUPS) {
    for (const category of group.categories) {
      expect(CATEGORY_NAMES).toContain(category)
      expect(getFolderCategory(category)).toBe(category)
    }
  }
})

test('Investments is selectable and contributes to its navigation group count', () => {
  const groups = getWorkspaceNavGroups(new Map<CategoryName, number>([['Investments', 2]]), 2, 0)
  const finance = groups.find((group) => group.title === 'Finance & admin')!
  expect(finance.items.find((item) => item.value === 'Investments')?.count).toBe(2)
  expect(getFolderCategory('Investments')).toBe('Investments')
})

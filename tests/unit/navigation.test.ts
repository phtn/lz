import { describe, expect, test } from 'vitest'
import { CATEGORY_NAMES } from '@/constants/meta'
import { branches, getFolderCategory, getWorkspaceNavGroups, navGroups } from '@/lib/navs'
import type { CategoryName } from '@/types/file'

describe('workspace navigation', () => {
  test('groups every file category exactly once and keeps workspace actions separate', () => {
    const folders = branches.flatMap((group) => group.items.map((item) => item.value))
    expect(folders).toHaveLength(28)
    expect(new Set(folders).size).toBe(folders.length)
    expect(folders.toSorted()).toEqual(CATEGORY_NAMES.toSorted())
    expect(navGroups[0].items.map((item) => item.value)).toEqual(['All', 'upload-activity'])
    expect(navGroups.flatMap((group) => group.items).some((item) => item.href)).toBe(false)
    expect(getFolderCategory('upload-activity')).toBeUndefined()
  })

  test('uses current account counts for folders and groups without changing shared definitions', () => {
    const counts = new Map<CategoryName, number>([['Invoices', 2], ['Images', 3], ['Travel', 1]])
    const groups = getWorkspaceNavGroups(counts, 6, 4)
    expect(groups[0].items.map((item) => item.count)).toEqual([6, 4])
    expect(groups.find((group) => group.title === 'Finance & admin')?.count).toBe(2)
    expect(groups.find((group) => group.title === 'Personal records')?.count).toBe(1)
    expect(groups.find((group) => group.title === 'Creative & media')?.count).toBe(3)
    expect(getWorkspaceNavGroups(new Map(), 0, 0).slice(1).every((group) => group.count === 0)).toBe(true)
    expect(navGroups.flatMap((group) => group.items).every((item) => item.count === undefined)).toBe(true)
  })
})

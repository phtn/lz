import { CATEGORY_GROUPS, CATEGORY_NAMES, SHOW_EMPTY_FOLDERS } from '@/constants/meta'
import type { IconName } from '@/lib/icons'
import type { CategoryName } from '@/types/file'

export type NavItem = {
  // Items without an href select a workspace view instead of navigating a route.
  href?: string
  icon: IconName
  label: string
  value: string
  tags: string[]
  description?: string
  short?: string
  disabled?: boolean
  count?: number
  className?: string
}

export type NavGroup = {
  title: string
  icon?: IconName
  items: NavItem[]
  label?: string
  count?: number
}

export const navGroups: NavGroup[] = CATEGORY_GROUPS.map(({ label, icon, categories }) => ({
  title: label,
  icon,
  items: categories.map((category) => ({
    value: category,
    icon: 'folder',
    label: category,
    short: category,
    description: `${category} in your file library`,
    tags: [category.toLowerCase(), 'files', 'smart folder'],
    className: 'folder-link'
  }))
}))

export const navHeader: NavGroup[] = [
  {
    title: 'Workspace',
    icon: 'folder',
    items: [
      { value: 'All', icon: 'folder', label: 'All files', tags: ['library', 'all files'], className: 'sidebar-link' },
      {
        value: 'upload-activity',
        icon: 'folder',
        label: 'Activity',
        tags: ['upload', 'queue'],
        className: 'sidebar-link'
      }
    ]
  }
]

export function getFolderCategory(value: string): Exclude<CategoryName, 'All'> | undefined {
  return CATEGORY_NAMES.find((category) => category === value)
}

export function getWorkspaceNavGroups(
  categoryCounts: ReadonlyMap<CategoryName, number>,
  fileCount: number,
  activeQueueCount: number
): NavGroup[] {
  return navGroups
    .map((group, index) => {
      const items = group.items
        .map((item) => {
          const category = getFolderCategory(item.value)
          const count =
            item.value === 'All'
              ? fileCount
              : item.value === 'upload-activity'
                ? activeQueueCount
                : category
                  ? (categoryCounts.get(category) ?? 0)
                  : 0
          return { ...item, count }
        })
        .filter((item) => index === 0 || SHOW_EMPTY_FOLDERS || item.count > 0)
      return { ...group, items, count: index === 0 ? undefined : items.reduce((sum, item) => sum + item.count, 0) }
    })
    .filter((group) => group.items.length > 0)
}

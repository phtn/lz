import type { OctaneNode } from 'octane'
import type { CategoryName, StoredFile } from './file'

export interface WorkspaceNavigationProps {
  activeQueueCount: number
  library: StoredFile[]
  activeCategory: CategoryName
  setActiveCategory: (category: CategoryName) => void
  categoryCounts: Map<CategoryName, number>
  onOpenQueue: VoidFunction
}

export interface WorkspaceTopbarProps {
  search: string
  setSearch: (value: string) => void
  searchInputRef: { current: HTMLInputElement | null }
  onAddFiles: VoidFunction
}

export interface WorkspaceLayoutProps {
  navigation: WorkspaceNavigationProps
  topbar: WorkspaceTopbarProps
  children?: OctaneNode
}

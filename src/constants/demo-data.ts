import type { StoredFile } from '@/types/file'

type ItemKind = 'image' | 'document' | 'video' | 'audio'
type DemoItem = StoredFile

const now: string = new Date().toISOString()

const IMAGE_URL: string = 'https://res.cloudinary.com/dx0heqhhe/image/upload/v1785992150/512_bhscfd.webp'

const items: DemoItem[] = Array.from({ length: 30 }, (_, index): DemoItem => {
  const n: number = index + 1
  return {
    id: `demo-${n}`,
    name: `demo image ${n}`,
    size: 100,
    mimeType: 'image/png',
    category: 'All',
    kind: 'image',
    confidence: 1,
    excerpt: 'demo',
    createdAt: now,
    url: IMAGE_URL
  }
})

export { items }
export type { DemoItem, ItemKind }

import Lenis from 'lenis'
import { useEffect, useRef } from 'octane'

export function useLenis(mode: 'page' | 'container') {
  const wrapperRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const wrapper = mode === 'container' ? wrapperRef.current : window
    const content = mode === 'container' ? contentRef.current : document.documentElement
    if (!wrapper || !content) return

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      anchors: mode === 'page',
      allowNestedScroll: true,
      // Account for library results before the resize observer's debounce ends.
      naiveDimensions: true,
      respectReducedMotion: true,
      // Keep touch scrolling native, including mobile pull and swipe gestures.
      syncTouch: false,
      prevent: (node) => node.tagName === 'DIALOG',
    })

    return () => lenis.destroy()
  })

  return { wrapperRef, contentRef }
}

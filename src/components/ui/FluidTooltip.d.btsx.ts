import type { ComponentBody, OctaneNode, ReactElement, Ref } from 'octane'

declare const FluidTooltip: ComponentBody<{
  children: OctaneNode
  orientation?: 'horizontal' | 'vertical' | 'auto'
  openDelay?: number
  closeDelay?: number
  disabled?: boolean
  className?: string
}>
export default FluidTooltip

export declare const FluidTooltipRoot: ComponentBody<{
  id: string
  children: OctaneNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  disabled?: boolean
}>
export declare const FluidTooltipTrigger: ComponentBody<{
  children: ReactElement
  render?: ReactElement
  keepOpenOnClick?: boolean
  ref?: Ref<HTMLElement | null>
}>
export declare const FluidTooltipContent: ComponentBody<{
  children: OctaneNode
  className?: string
  showArrow?: boolean
}>

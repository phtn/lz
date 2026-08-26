import { JSX } from 'octane/jsx-runtime'

type HTMLProp<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T]
export type ClassName = HTMLProp<'div'>['className']
export type VoidPromise = () => Promise<void>

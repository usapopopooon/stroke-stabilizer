import type { Point } from '../types'

/**
 * Convolution kernel (fixed weights)
 */
export interface Kernel {
  readonly type: string
  readonly weights: number[]
}

/**
 * Adaptive kernel (dynamic weight computation)
 */
export interface AdaptiveKernel {
  readonly type: string
  readonly size: number
  computeWeights(center: Point, neighbors: Point[]): number[]
}

/**
 * All kernel types
 */
export type AnyKernel = Kernel | AdaptiveKernel

/**
 * Check if kernel is adaptive
 */
export function isAdaptiveKernel(kernel: AnyKernel): kernel is AdaptiveKernel {
  return (
    'computeWeights' in kernel && typeof kernel.computeWeights === 'function'
  )
}

/**
 * Padding mode
 * - 'reflect': Reflect at edges [3,2,1] | [1,2,3,4,5] | [5,4,3]
 * - 'edge': Repeat edge values [1,1,1] | [1,2,3,4,5] | [5,5,5]
 * - 'zero': Zero padding [0,0,0] | [1,2,3,4,5] | [0,0,0]
 */
export type PaddingMode = 'reflect' | 'edge' | 'zero'

export interface SmoothOptions {
  kernel: AnyKernel
  padding?: PaddingMode
}

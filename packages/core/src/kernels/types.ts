import type { Point } from '../types'

/**
 * 畳み込みカーネル（固定重み）
 */
export interface Kernel {
  readonly type: string
  readonly weights: number[]
}

/**
 * 適応型カーネル（動的重み計算）
 */
export interface AdaptiveKernel {
  readonly type: string
  readonly size: number
  computeWeights(center: Point, neighbors: Point[]): number[]
}

/**
 * 全てのカーネル型
 */
export type AnyKernel = Kernel | AdaptiveKernel

/**
 * カーネルが適応型かどうかを判定
 */
export function isAdaptiveKernel(kernel: AnyKernel): kernel is AdaptiveKernel {
  return 'computeWeights' in kernel && typeof kernel.computeWeights === 'function'
}

/**
 * パディング方式
 * - 'reflect': 端を反射 [3,2,1] | [1,2,3,4,5] | [5,4,3]
 * - 'edge': 端の値を繰り返す [1,1,1] | [1,2,3,4,5] | [5,5,5]
 * - 'zero': ゼロ埋め [0,0,0] | [1,2,3,4,5] | [0,0,0]
 */
export type PaddingMode = 'reflect' | 'edge' | 'zero'

export interface SmoothOptions {
  kernel: AnyKernel
  padding?: PaddingMode
}

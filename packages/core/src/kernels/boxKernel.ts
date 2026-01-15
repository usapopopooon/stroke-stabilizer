import type { Kernel } from './types'

export interface BoxKernelParams {
  /** カーネルサイズ（奇数） */
  size: number
}

/**
 * ボックスカーネル（単純平均）を生成
 *
 * @example
 * ```ts
 * const kernel = boxKernel({ size: 5 })
 * // weights: [0.2, 0.2, 0.2, 0.2, 0.2]
 * ```
 */
export function boxKernel(params: BoxKernelParams): Kernel {
  const { size } = params

  // サイズを奇数に強制
  const actualSize = size % 2 === 0 ? size + 1 : size
  const weight = 1 / actualSize

  const weights = Array(actualSize).fill(weight)

  return {
    type: 'box',
    weights,
  }
}

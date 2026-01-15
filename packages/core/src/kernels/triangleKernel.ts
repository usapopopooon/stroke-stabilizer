import type { Kernel } from './types'

export interface TriangleKernelParams {
  /** カーネルサイズ（奇数） */
  size: number
}

/**
 * 三角カーネル（中央重み付け）を生成
 *
 * @example
 * ```ts
 * const kernel = triangleKernel({ size: 5 })
 * // weights: [1/9, 2/9, 3/9, 2/9, 1/9] (正規化後)
 * ```
 */
export function triangleKernel(params: TriangleKernelParams): Kernel {
  const { size } = params

  // サイズを奇数に強制
  const actualSize = size % 2 === 0 ? size + 1 : size
  const halfSize = Math.floor(actualSize / 2)

  const weights: number[] = []
  let sum = 0

  for (let i = 0; i < actualSize; i++) {
    // 中央が最大、端に行くほど小さい
    const weight = halfSize + 1 - Math.abs(i - halfSize)
    weights.push(weight)
    sum += weight
  }

  // 正規化
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum
  }

  return {
    type: 'triangle',
    weights,
  }
}

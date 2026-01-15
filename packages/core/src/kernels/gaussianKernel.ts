import type { Kernel } from './types'

export interface GaussianKernelParams {
  /** カーネルサイズ（奇数） */
  size: number
  /** 標準偏差（省略時: size / 3） */
  sigma?: number
}

/**
 * ガウシアンカーネルを生成
 *
 * @example
 * ```ts
 * const kernel = gaussianKernel({ size: 7, sigma: 2 })
 * ```
 */
export function gaussianKernel(params: GaussianKernelParams): Kernel {
  const { size } = params
  const sigma = params.sigma ?? size / 3

  // サイズを奇数に強制
  const actualSize = size % 2 === 0 ? size + 1 : size
  const halfSize = Math.floor(actualSize / 2)

  const weights: number[] = []
  let sum = 0

  for (let i = 0; i < actualSize; i++) {
    const x = i - halfSize
    const weight = Math.exp(-(x * x) / (2 * sigma * sigma))
    weights.push(weight)
    sum += weight
  }

  // 正規化
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum
  }

  return {
    type: 'gaussian',
    weights,
  }
}

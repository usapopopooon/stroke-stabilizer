import type { Kernel } from './types'

export interface GaussianKernelParams {
  /** Kernel size (odd number) */
  size: number
  /** Standard deviation (default: size / 3) */
  sigma?: number
}

/**
 * Generate a Gaussian kernel
 *
 * @example
 * ```ts
 * const kernel = gaussianKernel({ size: 7, sigma: 2 })
 * ```
 */
export function gaussianKernel(params: GaussianKernelParams): Kernel {
  const { size } = params
  const sigma = params.sigma ?? size / 3

  // Force odd size
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

  // Normalize
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum
  }

  return {
    type: 'gaussian',
    weights,
  }
}

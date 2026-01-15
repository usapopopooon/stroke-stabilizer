import type { Kernel } from './types'

export interface TriangleKernelParams {
  /** Kernel size (odd number) */
  size: number
}

/**
 * Generate a triangle kernel (center-weighted)
 *
 * @example
 * ```ts
 * const kernel = triangleKernel({ size: 5 })
 * // weights: [1/9, 2/9, 3/9, 2/9, 1/9] (normalized)
 * ```
 */
export function triangleKernel(params: TriangleKernelParams): Kernel {
  const { size } = params

  // Force odd size
  const actualSize = size % 2 === 0 ? size + 1 : size
  const halfSize = Math.floor(actualSize / 2)

  const weights: number[] = []
  let sum = 0

  for (let i = 0; i < actualSize; i++) {
    // Maximum at center, decreasing toward edges
    const weight = halfSize + 1 - Math.abs(i - halfSize)
    weights.push(weight)
    sum += weight
  }

  // Normalize
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum
  }

  return {
    type: 'triangle',
    weights,
  }
}

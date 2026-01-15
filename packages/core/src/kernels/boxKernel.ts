import type { Kernel } from './types'

export interface BoxKernelParams {
  /** Kernel size (odd number) */
  size: number
}

/**
 * Generate a box kernel (simple average)
 *
 * @example
 * ```ts
 * const kernel = boxKernel({ size: 5 })
 * // weights: [0.2, 0.2, 0.2, 0.2, 0.2]
 * ```
 */
export function boxKernel(params: BoxKernelParams): Kernel {
  const { size } = params

  // Force odd size
  const actualSize = size % 2 === 0 ? size + 1 : size
  const weight = 1 / actualSize

  const weights = Array(actualSize).fill(weight)

  return {
    type: 'box',
    weights,
  }
}

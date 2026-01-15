import type { Point } from '../types'

export interface BilateralKernelParams {
  /**
   * Kernel size (odd number)
   * Recommended: 5-11
   */
  size: number
  /**
   * Spatial standard deviation
   * Weight decay based on index distance
   * Recommended: size / 3
   */
  sigmaSpace?: number
  /**
   * Value standard deviation
   * Weight decay based on coordinate value difference (edge preservation)
   * Lower = stronger edge preservation
   * Recommended: 5-30
   */
  sigmaValue: number
}

export interface BilateralKernel {
  readonly type: 'bilateral'
  readonly size: number
  readonly sigmaSpace: number
  readonly sigmaValue: number
  /**
   * Dynamically compute weights for each point
   */
  computeWeights(center: Point, neighbors: Point[]): number[]
}

/**
 * Generate a bilateral kernel
 *
 * Unlike standard convolution, weights are determined considering
 * coordinate value similarity. This enables smoothing while preserving
 * edges (sharp direction changes, etc.).
 *
 * @example
 * ```ts
 * const kernel = bilateralKernel({
 *   size: 7,
 *   sigmaValue: 10
 * })
 * ```
 */
export function bilateralKernel(
  params: BilateralKernelParams
): BilateralKernel {
  const { size, sigmaValue } = params
  const actualSize = size % 2 === 0 ? size + 1 : size
  const sigmaSpace = params.sigmaSpace ?? actualSize / 3

  const halfSize = Math.floor(actualSize / 2)

  // Pre-compute spatial weights
  const spatialWeights: number[] = []
  for (let i = 0; i < actualSize; i++) {
    const d = i - halfSize
    spatialWeights.push(Math.exp(-(d * d) / (2 * sigmaSpace * sigmaSpace)))
  }

  return {
    type: 'bilateral',
    size: actualSize,
    sigmaSpace,
    sigmaValue,

    computeWeights(center: Point, neighbors: Point[]): number[] {
      const weights: number[] = []
      let sum = 0

      for (let i = 0; i < neighbors.length; i++) {
        // Calculate coordinate value difference
        const dx = neighbors[i].x - center.x
        const dy = neighbors[i].y - center.y
        const valueDiff = dx * dx + dy * dy

        // Value-based weight
        const valueWeight = Math.exp(-valueDiff / (2 * sigmaValue * sigmaValue))

        // Spatial × value weight
        const weight = spatialWeights[i] * valueWeight
        weights.push(weight)
        sum += weight
      }

      // Normalize
      if (sum > 0) {
        for (let i = 0; i < weights.length; i++) {
          weights[i] /= sum
        }
      }

      return weights
    },
  }
}

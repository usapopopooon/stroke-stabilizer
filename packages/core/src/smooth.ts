import type { Point } from './types'
import type { PaddingMode, SmoothOptions, Kernel } from './kernels/types'
import { isAdaptiveKernel } from './kernels/types'

/**
 * Apply padding to extend point array
 */
function applyPadding(
  points: Point[],
  halfSize: number,
  mode: PaddingMode
): Point[] {
  if (points.length === 0) return []

  const padded: Point[] = []

  // Leading padding
  for (let i = halfSize; i > 0; i--) {
    switch (mode) {
      case 'reflect':
        padded.push(points[Math.min(i, points.length - 1)])
        break
      case 'edge':
        padded.push(points[0])
        break
      case 'zero':
        padded.push({ x: 0, y: 0 })
        break
    }
  }

  // Original data
  padded.push(...points)

  // Trailing padding
  for (let i = 1; i <= halfSize; i++) {
    switch (mode) {
      case 'reflect':
        padded.push(points[Math.max(0, points.length - 1 - i)])
        break
      case 'edge':
        padded.push(points[points.length - 1])
        break
      case 'zero':
        padded.push({ x: 0, y: 0 })
        break
    }
  }

  return padded
}

/**
 * Bidirectional convolution smoothing
 *
 * Supports both fixed-weight kernels (Gaussian, Box, Triangle) and
 * adaptive kernels (Bilateral).
 *
 * @example
 * ```ts
 * import { smooth, gaussianKernel, bilateralKernel } from '@stroke-stabilizer/core'
 *
 * // Standard convolution
 * const smoothed = smooth(points, {
 *   kernel: gaussianKernel({ size: 7 }),
 *   padding: 'reflect',
 * })
 *
 * // Bilateral (edge-preserving)
 * const edgePreserved = smooth(points, {
 *   kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
 *   padding: 'reflect',
 * })
 * ```
 */
export function smooth(points: Point[], options: SmoothOptions): Point[] {
  const { kernel, padding = 'reflect', preserveEndpoints = true } = options

  if (points.length === 0) return []

  // Save original endpoints if preserving
  const originalStart = points[0]
  const originalEnd = points[points.length - 1]

  let result: Point[]

  // Adaptive kernel (Bilateral, etc.)
  if (isAdaptiveKernel(kernel)) {
    const halfSize = Math.floor(kernel.size / 2)
    const padded = applyPadding(points, halfSize, padding)

    result = []

    for (let i = 0; i < points.length; i++) {
      const centerIdx = i + halfSize
      const center = padded[centerIdx]
      const neighbors: Point[] = []

      for (let k = 0; k < kernel.size; k++) {
        neighbors.push(padded[i + k])
      }

      const weights = kernel.computeWeights(center, neighbors)

      let sumX = 0
      let sumY = 0

      for (let k = 0; k < weights.length; k++) {
        sumX += neighbors[k].x * weights[k]
        sumY += neighbors[k].y * weights[k]
      }

      result.push({ x: sumX, y: sumY })
    }
  } else {
    // Fixed-weight kernel (Gaussian, Box, Triangle, etc.)
    const fixedKernel = kernel as Kernel
    const { weights } = fixedKernel

    if (weights.length <= 1) return [...points]

    const halfSize = Math.floor(weights.length / 2)
    const padded = applyPadding(points, halfSize, padding)

    result = []

    for (let i = 0; i < points.length; i++) {
      let sumX = 0
      let sumY = 0

      for (let k = 0; k < weights.length; k++) {
        const point = padded[i + k]
        sumX += point.x * weights[k]
        sumY += point.y * weights[k]
      }

      result.push({ x: sumX, y: sumY })
    }
  }

  // Restore original endpoints if preserving
  if (preserveEndpoints && result.length > 0) {
    result[0] = { ...originalStart }
    if (result.length > 1) {
      result[result.length - 1] = { ...originalEnd }
    }
  }

  return result
}

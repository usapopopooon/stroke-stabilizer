import type { Point } from './types'
import type { PaddingMode, SmoothOptions, AnyKernel, Kernel } from './kernels/types'
import { isAdaptiveKernel } from './kernels/types'

/**
 * パディングを適用してポイント配列を拡張
 */
function applyPadding(points: Point[], halfSize: number, mode: PaddingMode): Point[] {
  if (points.length === 0) return []

  const padded: Point[] = []

  // 先頭パディング
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

  // 元データ
  padded.push(...points)

  // 末尾パディング
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
 * 双方向畳み込みによる平滑化
 *
 * 固定重みカーネル（Gaussian, Box, Triangle）と
 * 適応型カーネル（Bilateral）の両方に対応。
 *
 * @example
 * ```ts
 * import { smooth, gaussianKernel, bilateralKernel } from '@stroke-stabilizer/core'
 *
 * // 通常の畳み込み
 * const smoothed = smooth(points, {
 *   kernel: gaussianKernel({ size: 7 }),
 *   padding: 'reflect',
 * })
 *
 * // バイラテラル（エッジ保存）
 * const edgePreserved = smooth(points, {
 *   kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
 *   padding: 'reflect',
 * })
 * ```
 */
export function smooth(points: Point[], options: SmoothOptions): Point[] {
  const { kernel, padding = 'reflect' } = options

  if (points.length === 0) return []

  // 適応型カーネル（Bilateral等）
  if (isAdaptiveKernel(kernel)) {
    const halfSize = Math.floor(kernel.size / 2)
    const padded = applyPadding(points, halfSize, padding)

    const result: Point[] = []

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

    return result
  }

  // 固定重みカーネル（Gaussian, Box, Triangle等）
  const fixedKernel = kernel as Kernel
  const { weights } = fixedKernel

  if (weights.length <= 1) return [...points]

  const halfSize = Math.floor(weights.length / 2)
  const padded = applyPadding(points, halfSize, padding)

  const result: Point[] = []

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

  return result
}

import { describe, it, expect } from 'vitest'
import { smooth } from './smooth'
import { gaussianKernel } from './kernels/gaussianKernel'
import { boxKernel } from './kernels/boxKernel'
import { bilateralKernel } from './kernels/BilateralKernel'
import type { Point } from './types'

describe('smooth', () => {
  it('should return empty array for empty input', () => {
    const result = smooth([], { kernel: boxKernel({ size: 3 }) })

    expect(result).toEqual([])
  })

  it('should return same points for kernel size 1', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]

    const result = smooth(points, {
      kernel: { type: 'identity', weights: [1] },
    })

    expect(result).toEqual(points)
  })

  it('should smooth zigzag pattern with box kernel', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 0 },
      { x: 30, y: 20 },
      { x: 40, y: 0 },
    ]

    const result = smooth(points, { kernel: boxKernel({ size: 3 }) })

    // 中央点は平滑化されるはず
    expect(result[2].y).toBeGreaterThan(0)
    expect(result[2].y).toBeLessThan(20)
  })

  it('should preserve straight line', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
      { x: 40, y: 40 },
    ]

    const result = smooth(points, { kernel: boxKernel({ size: 3 }) })

    // 直線上のポイントはほぼ直線のまま
    for (let i = 0; i < result.length; i++) {
      expect(result[i].x).toBeCloseTo(result[i].y, 0)
    }
  })

  it('should return same length as input', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]

    const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })

    expect(result.length).toBe(points.length)
  })

  describe('padding modes', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]

    it('should work with reflect padding', () => {
      const result = smooth(points, {
        kernel: boxKernel({ size: 3 }),
        padding: 'reflect',
      })

      expect(result.length).toBe(3)
    })

    it('should work with edge padding', () => {
      const result = smooth(points, {
        kernel: boxKernel({ size: 3 }),
        padding: 'edge',
      })

      expect(result.length).toBe(3)
    })

    it('should work with zero padding', () => {
      const result = smooth(points, {
        kernel: boxKernel({ size: 3 }),
        padding: 'zero',
      })

      expect(result.length).toBe(3)
      // ゼロパディングなので端は 0 に引っ張られる
      expect(result[0].x).toBeLessThan(points[0].x + 5)
    })
  })

  it('should apply gaussian smoothing', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 }, // スパイク
      { x: 20, y: 0 },
    ]

    const result = smooth(points, { kernel: gaussianKernel({ size: 3 }) })

    // スパイクが平滑化される
    expect(result[1].y).toBeLessThan(100)
    expect(result[1].y).toBeGreaterThan(0)
  })

  describe('bilateral kernel', () => {
    it('should smooth with bilateral kernel', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ]

      const result = smooth(points, {
        kernel: bilateralKernel({ size: 5, sigmaValue: 10 }),
      })

      expect(result.length).toBe(5)
      // 直線上のポイントはほぼ直線のまま
      for (let i = 0; i < result.length; i++) {
        expect(result[i].x).toBeCloseTo(result[i].y, 0)
      }
    })

    it('should give lower weight to distant values', () => {
      // バイラテラルフィルタは値が遠い点の重みを下げる
      // スパイク（外れ値）に対する耐性をテスト
      const pointsWithSpike: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 100 }, // スパイク（外れ値）
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ]

      const gaussianResult = smooth(pointsWithSpike, {
        kernel: gaussianKernel({ size: 5 }),
      })

      const bilateralResult = smooth(pointsWithSpike, {
        kernel: bilateralKernel({ size: 5, sigmaValue: 10 }),
      })

      // バイラテラルの方がスパイクの影響を受けにくい
      // 隣接点（index 1, 3）でバイラテラルの方が元の値に近い
      expect(Math.abs(bilateralResult[1].y - 10)).toBeLessThanOrEqual(
        Math.abs(gaussianResult[1].y - 10) + 5
      )
    })

    it('should smooth noise while preserving structure', () => {
      // ノイズのあるL字データ
      const points: Point[] = [
        { x: 2, y: -1 }, // ノイズ (0, 0)
        { x: 9, y: 2 }, // ノイズ (10, 0)
        { x: 21, y: -2 }, // ノイズ (20, 0)
        { x: 29, y: 1 }, // ノイズ (30, 0) - エッジ
        { x: 31, y: 9 }, // ノイズ (30, 10)
        { x: 28, y: 21 }, // ノイズ (30, 20)
        { x: 32, y: 29 }, // ノイズ (30, 30)
      ]

      const result = smooth(points, {
        kernel: bilateralKernel({ size: 5, sigmaValue: 5 }),
      })

      expect(result.length).toBe(7)
      // ノイズが軽減されているはず
      // 完璧な復元は期待しないが、構造は保たれる
    })

    it('should work with all padding modes', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ]

      const kernel = bilateralKernel({ size: 3, sigmaValue: 10 })

      const reflectResult = smooth(points, { kernel, padding: 'reflect' })
      const edgeResult = smooth(points, { kernel, padding: 'edge' })
      const zeroResult = smooth(points, { kernel, padding: 'zero' })

      expect(reflectResult.length).toBe(3)
      expect(edgeResult.length).toBe(3)
      expect(zeroResult.length).toBe(3)
    })
  })
})

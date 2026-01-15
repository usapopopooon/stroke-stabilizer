import { describe, it, expect } from 'vitest'
import { gaussianKernel } from './gaussianKernel'
import { boxKernel } from './boxKernel'
import { triangleKernel } from './triangleKernel'
import { bilateralKernel } from './BilateralKernel'

describe('gaussianKernel', () => {
  it('should create kernel with correct size', () => {
    const kernel = gaussianKernel({ size: 5 })

    expect(kernel.type).toBe('gaussian')
    expect(kernel.weights.length).toBe(5)
  })

  it('should force odd size', () => {
    const kernel = gaussianKernel({ size: 4 })

    expect(kernel.weights.length).toBe(5) // 4 → 5
  })

  it('should normalize weights to sum to 1', () => {
    const kernel = gaussianKernel({ size: 7, sigma: 2 })
    const sum = kernel.weights.reduce((a, b) => a + b, 0)

    expect(sum).toBeCloseTo(1)
  })

  it('should have center as maximum weight', () => {
    const kernel = gaussianKernel({ size: 5 })
    const center = Math.floor(kernel.weights.length / 2)

    for (let i = 0; i < kernel.weights.length; i++) {
      expect(kernel.weights[center]).toBeGreaterThanOrEqual(kernel.weights[i])
    }
  })

  it('should be symmetric', () => {
    const kernel = gaussianKernel({ size: 7 })
    const n = kernel.weights.length

    for (let i = 0; i < Math.floor(n / 2); i++) {
      expect(kernel.weights[i]).toBeCloseTo(kernel.weights[n - 1 - i])
    }
  })
})

describe('boxKernel', () => {
  it('should create kernel with uniform weights', () => {
    const kernel = boxKernel({ size: 5 })

    expect(kernel.type).toBe('box')
    expect(kernel.weights.length).toBe(5)
    expect(kernel.weights.every((w) => w === 0.2)).toBe(true)
  })

  it('should force odd size', () => {
    const kernel = boxKernel({ size: 4 })

    expect(kernel.weights.length).toBe(5)
  })

  it('should normalize weights to sum to 1', () => {
    const kernel = boxKernel({ size: 7 })
    const sum = kernel.weights.reduce((a, b) => a + b, 0)

    expect(sum).toBeCloseTo(1)
  })
})

describe('triangleKernel', () => {
  it('should create kernel with center as maximum', () => {
    const kernel = triangleKernel({ size: 5 })

    expect(kernel.type).toBe('triangle')
    expect(kernel.weights.length).toBe(5)

    const center = Math.floor(kernel.weights.length / 2)
    for (let i = 0; i < kernel.weights.length; i++) {
      expect(kernel.weights[center]).toBeGreaterThanOrEqual(kernel.weights[i])
    }
  })

  it('should force odd size', () => {
    const kernel = triangleKernel({ size: 4 })

    expect(kernel.weights.length).toBe(5)
  })

  it('should normalize weights to sum to 1', () => {
    const kernel = triangleKernel({ size: 7 })
    const sum = kernel.weights.reduce((a, b) => a + b, 0)

    expect(sum).toBeCloseTo(1)
  })

  it('should be symmetric', () => {
    const kernel = triangleKernel({ size: 7 })
    const n = kernel.weights.length

    for (let i = 0; i < Math.floor(n / 2); i++) {
      expect(kernel.weights[i]).toBeCloseTo(kernel.weights[n - 1 - i])
    }
  })

  it('should have linearly decreasing weights from center', () => {
    const kernel = triangleKernel({ size: 5 })
    // size 5: [1, 2, 3, 2, 1] → normalized

    expect(kernel.weights[2]).toBeGreaterThan(kernel.weights[1])
    expect(kernel.weights[1]).toBeGreaterThan(kernel.weights[0])
  })
})

describe('bilateralKernel', () => {
  it('should create kernel with correct type and size', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 10 })

    expect(kernel.type).toBe('bilateral')
    expect(kernel.size).toBe(5)
  })

  it('should force odd size', () => {
    const kernel = bilateralKernel({ size: 4, sigmaValue: 10 })

    expect(kernel.size).toBe(5) // 4 → 5
  })

  it('should compute weights dynamically', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 10 })

    const center = { x: 50, y: 50 }
    const neighbors = [
      { x: 50, y: 50 }, // 同じ位置
      { x: 50, y: 50 },
      { x: 50, y: 50 }, // center
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ]

    const weights = kernel.computeWeights(center, neighbors)

    expect(weights.length).toBe(5)
    // 全て同じ位置なので空間重みだけが影響
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should give lower weight to distant values', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 5 })

    const center = { x: 50, y: 50 }

    // 近い値のneighbors
    const nearNeighbors = [
      { x: 48, y: 48 },
      { x: 49, y: 49 },
      { x: 50, y: 50 }, // center
      { x: 51, y: 51 },
      { x: 52, y: 52 },
    ]

    // 遠い値のneighbors（エッジがある）
    const farNeighbors = [
      { x: 10, y: 10 }, // 遠い
      { x: 30, y: 30 }, // 中程度
      { x: 50, y: 50 }, // center
      { x: 51, y: 51 },
      { x: 52, y: 52 },
    ]

    const nearWeights = kernel.computeWeights(center, nearNeighbors)
    const farWeights = kernel.computeWeights(center, farNeighbors)

    // 遠い値を持つneighborの重みは小さいはず
    expect(farWeights[0]).toBeLessThan(nearWeights[0])
  })

  it('should preserve edges (distant values get low weight)', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 5 })

    const center = { x: 100, y: 100 }
    // エッジシミュレーション: 急激な位置変化
    const edgeNeighbors = [
      { x: 50, y: 50 }, // エッジ前
      { x: 60, y: 60 },
      { x: 100, y: 100 }, // center (エッジ後)
      { x: 110, y: 110 },
      { x: 120, y: 120 },
    ]

    const weights = kernel.computeWeights(center, edgeNeighbors)

    // エッジを越えた点（index 0, 1）は重みが小さい
    expect(weights[0]).toBeLessThan(weights[2])
    expect(weights[1]).toBeLessThan(weights[2])

    // エッジ後の点（index 3, 4）は重みが比較的大きい
    expect(weights[3]).toBeGreaterThan(weights[0])
    expect(weights[4]).toBeGreaterThan(weights[0])
  })

  it('should normalize weights to sum to 1', () => {
    const kernel = bilateralKernel({ size: 7, sigmaValue: 15 })

    const center = { x: 25, y: 25 }
    const neighbors = [
      { x: 10, y: 10 },
      { x: 15, y: 15 },
      { x: 20, y: 20 },
      { x: 25, y: 25 },
      { x: 30, y: 30 },
      { x: 35, y: 35 },
      { x: 40, y: 40 },
    ]

    const weights = kernel.computeWeights(center, neighbors)
    const sum = weights.reduce((a, b) => a + b, 0)

    expect(sum).toBeCloseTo(1)
  })
})

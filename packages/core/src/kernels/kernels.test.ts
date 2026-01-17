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

// ============================================
// Edge Case Tests
// ============================================

describe('gaussianKernel - Edge Cases', () => {
  it('should handle size = 1', () => {
    const kernel = gaussianKernel({ size: 1 })
    expect(kernel.weights.length).toBe(1)
    expect(kernel.weights[0]).toBe(1)
  })

  it('should handle very large size', () => {
    const kernel = gaussianKernel({ size: 51 })
    expect(kernel.weights.length).toBe(51)
    const sum = kernel.weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle very small sigma', () => {
    const kernel = gaussianKernel({ size: 5, sigma: 0.1 })
    expect(kernel.weights.length).toBe(5)
    // Small sigma = center-heavy distribution
    const center = Math.floor(kernel.weights.length / 2)
    expect(kernel.weights[center]).toBeGreaterThan(0.9)
  })

  it('should handle very large sigma', () => {
    const kernel = gaussianKernel({ size: 5, sigma: 100 })
    expect(kernel.weights.length).toBe(5)
    // Large sigma = nearly uniform distribution
    const variance = computeVariance(kernel.weights)
    expect(variance).toBeLessThan(0.01)
  })

  it('should default sigma based on size', () => {
    const kernel = gaussianKernel({ size: 7 })
    expect(kernel.weights.length).toBe(7)
    // Should be well-distributed, not all weight at center
    expect(kernel.weights[0]).toBeGreaterThan(0.01)
  })

  it('should handle minimum odd size', () => {
    const kernel = gaussianKernel({ size: 3 })
    expect(kernel.weights.length).toBe(3)
    expect(kernel.weights[1]).toBeGreaterThan(kernel.weights[0])
  })
})

describe('boxKernel - Edge Cases', () => {
  it('should handle size = 1', () => {
    const kernel = boxKernel({ size: 1 })
    expect(kernel.weights.length).toBe(1)
    expect(kernel.weights[0]).toBe(1)
  })

  it('should handle very large size', () => {
    const kernel = boxKernel({ size: 101 })
    expect(kernel.weights.length).toBe(101)
    const expectedWeight = 1 / 101
    expect(
      kernel.weights.every((w) => Math.abs(w - expectedWeight) < 0.0001)
    ).toBe(true)
  })

  it('should convert even size to odd', () => {
    const kernel = boxKernel({ size: 10 })
    expect(kernel.weights.length).toBe(11)
  })

  it('should handle size = 3', () => {
    const kernel = boxKernel({ size: 3 })
    expect(kernel.weights.length).toBe(3)
    expect(kernel.weights.every((w) => Math.abs(w - 1 / 3) < 0.0001)).toBe(true)
  })
})

describe('triangleKernel - Edge Cases', () => {
  it('should handle size = 1', () => {
    const kernel = triangleKernel({ size: 1 })
    expect(kernel.weights.length).toBe(1)
    expect(kernel.weights[0]).toBe(1)
  })

  it('should handle size = 3', () => {
    const kernel = triangleKernel({ size: 3 })
    expect(kernel.weights.length).toBe(3)
    // [1, 2, 1] / 4 = [0.25, 0.5, 0.25]
    expect(kernel.weights[1]).toBeCloseTo(0.5)
    expect(kernel.weights[0]).toBeCloseTo(0.25)
    expect(kernel.weights[2]).toBeCloseTo(0.25)
  })

  it('should handle very large size', () => {
    const kernel = triangleKernel({ size: 51 })
    expect(kernel.weights.length).toBe(51)
    const sum = kernel.weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should have decreasing weights from center to edges', () => {
    const kernel = triangleKernel({ size: 9 })
    const center = 4
    for (let i = 0; i < center; i++) {
      expect(kernel.weights[i]).toBeLessThan(kernel.weights[i + 1])
    }
    for (let i = center; i < kernel.weights.length - 1; i++) {
      expect(kernel.weights[i]).toBeGreaterThan(kernel.weights[i + 1])
    }
  })
})

describe('bilateralKernel - Edge Cases', () => {
  it('should handle size = 1', () => {
    const kernel = bilateralKernel({ size: 1, sigmaValue: 10 })
    expect(kernel.size).toBe(1)
    const weights = kernel.computeWeights({ x: 0, y: 0 }, [{ x: 0, y: 0 }])
    expect(weights.length).toBe(1)
    expect(weights[0]).toBe(1)
  })

  it('should handle very small sigmaValue', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 0.1 })
    const center = { x: 50, y: 50 }
    const neighbors = [
      { x: 40, y: 40 },
      { x: 45, y: 45 },
      { x: 50, y: 50 },
      { x: 55, y: 55 },
      { x: 60, y: 60 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    // Very small sigmaValue = center gets almost all weight
    expect(weights[2]).toBeGreaterThan(0.9)
  })

  it('should handle very large sigmaValue', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 1000 })
    const center = { x: 50, y: 50 }
    const neighbors = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 75, y: 75 },
      { x: 100, y: 100 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    // Large sigmaValue = value difference doesn't matter much
    // Only spatial weights matter
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle custom sigmaSpace', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 10, sigmaSpace: 0.5 })
    const center = { x: 50, y: 50 }
    const neighbors = [
      { x: 48, y: 48 },
      { x: 49, y: 49 },
      { x: 50, y: 50 },
      { x: 51, y: 51 },
      { x: 52, y: 52 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    expect(weights.length).toBe(5)
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle neighbors at same position as center', () => {
    const kernel = bilateralKernel({ size: 3, sigmaValue: 10 })
    const center = { x: 50, y: 50 }
    const neighbors = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    // All same position = equal weights based on spatial kernel
    expect(weights.every((w) => w > 0)).toBe(true)
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle negative coordinates', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 10 })
    const center = { x: -50, y: -50 }
    const neighbors = [
      { x: -60, y: -60 },
      { x: -55, y: -55 },
      { x: -50, y: -50 },
      { x: -45, y: -45 },
      { x: -40, y: -40 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    expect(weights.length).toBe(5)
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle very large coordinates', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 10 })
    const center = { x: 1000000, y: 1000000 }
    const neighbors = [
      { x: 999990, y: 999990 },
      { x: 999995, y: 999995 },
      { x: 1000000, y: 1000000 },
      { x: 1000005, y: 1000005 },
      { x: 1000010, y: 1000010 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    expect(weights.every((w) => isFinite(w))).toBe(true)
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('should handle mixed positive and negative coordinates', () => {
    const kernel = bilateralKernel({ size: 5, sigmaValue: 50 })
    const center = { x: 0, y: 0 }
    const neighbors = [
      { x: -20, y: -20 },
      { x: -10, y: -10 },
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]
    const weights = kernel.computeWeights(center, neighbors)
    expect(weights.length).toBe(5)
    // Symmetric distribution around center
    expect(weights[0]).toBeCloseTo(weights[4])
    expect(weights[1]).toBeCloseTo(weights[3])
  })
})

// Helper function
function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

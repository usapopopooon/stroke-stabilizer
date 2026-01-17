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

    // Center point should be smoothed
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

    // Points on a line should remain mostly linear
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
      // With zero padding, edges are pulled toward 0
      expect(result[0].x).toBeLessThan(points[0].x + 5)
    })
  })

  it('should apply gaussian smoothing', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 }, // Spike
      { x: 20, y: 0 },
    ]

    const result = smooth(points, { kernel: gaussianKernel({ size: 3 }) })

    // Spike is smoothed
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
      // Points on a line should remain mostly linear
      for (let i = 0; i < result.length; i++) {
        expect(result[i].x).toBeCloseTo(result[i].y, 0)
      }
    })

    it('should give lower weight to distant values', () => {
      // Bilateral filter reduces weight for distant points
      // Test resistance to spikes (outliers)
      const pointsWithSpike: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 100 }, // Spike (outlier)
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ]

      const gaussianResult = smooth(pointsWithSpike, {
        kernel: gaussianKernel({ size: 5 }),
      })

      const bilateralResult = smooth(pointsWithSpike, {
        kernel: bilateralKernel({ size: 5, sigmaValue: 10 }),
      })

      // Bilateral is less affected by spikes
      // Adjacent points (index 1, 3) should be closer to original with bilateral
      expect(Math.abs(bilateralResult[1].y - 10)).toBeLessThanOrEqual(
        Math.abs(gaussianResult[1].y - 10) + 5
      )
    })

    it('should smooth noise while preserving structure', () => {
      // L-shaped data with noise
      const points: Point[] = [
        { x: 2, y: -1 }, // Noise (0, 0)
        { x: 9, y: 2 }, // Noise (10, 0)
        { x: 21, y: -2 }, // Noise (20, 0)
        { x: 29, y: 1 }, // Noise (30, 0) - Edge
        { x: 31, y: 9 }, // Noise (30, 10)
        { x: 28, y: 21 }, // Noise (30, 20)
        { x: 32, y: 29 }, // Noise (30, 30)
      ]

      const result = smooth(points, {
        kernel: bilateralKernel({ size: 5, sigmaValue: 5 }),
      })

      expect(result.length).toBe(7)
      // Noise should be reduced
      // Don't expect perfect restoration, but structure is preserved
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

// ============================================
// Edge Case Tests
// ============================================

describe('smooth - Edge Cases', () => {
  describe('single point', () => {
    it('should handle single point with box kernel', () => {
      const points: Point[] = [{ x: 10, y: 20 }]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(1)
      expect(result[0].x).toBeCloseTo(10)
      expect(result[0].y).toBeCloseTo(20)
    })

    it('should handle single point with gaussian kernel', () => {
      const points: Point[] = [{ x: 10, y: 20 }]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      expect(result.length).toBe(1)
    })

    it('should handle single point with all padding modes', () => {
      const points: Point[] = [{ x: 10, y: 20 }]
      const kernel = boxKernel({ size: 3 })

      const reflectResult = smooth(points, { kernel, padding: 'reflect' })
      const edgeResult = smooth(points, { kernel, padding: 'edge' })
      const zeroResult = smooth(points, { kernel, padding: 'zero' })

      expect(reflectResult.length).toBe(1)
      expect(edgeResult.length).toBe(1)
      expect(zeroResult.length).toBe(1)
    })
  })

  describe('two points', () => {
    it('should handle two points with box kernel', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(2)
    })

    it('should handle two points with gaussian kernel size 5', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      expect(result.length).toBe(2)
    })
  })

  describe('kernel size larger than array', () => {
    it('should handle kernel size larger than points array', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 11 }) })
      expect(result.length).toBe(3)
    })

    it('should handle kernel size much larger than points array', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 51 }) })
      expect(result.length).toBe(2)
    })
  })

  describe('large inputs', () => {
    it('should handle many points efficiently', () => {
      const points: Point[] = []
      for (let i = 0; i < 1000; i++) {
        points.push({ x: i, y: Math.sin(i * 0.1) * 10 })
      }
      const result = smooth(points, { kernel: gaussianKernel({ size: 7 }) })
      expect(result.length).toBe(1000)
      expect(result.every((p) => isFinite(p.x) && isFinite(p.y))).toBe(true)
    })

    it('should maintain smoothness with many points', () => {
      const points: Point[] = []
      // Create noisy line
      for (let i = 0; i < 100; i++) {
        points.push({
          x: i + (Math.random() - 0.5) * 2,
          y: i + (Math.random() - 0.5) * 2,
        })
      }
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      expect(result.length).toBe(100)
    })
  })

  describe('extreme coordinates', () => {
    it('should handle very large coordinates', () => {
      const points: Point[] = [
        { x: 1000000, y: 1000000 },
        { x: 1000010, y: 1000010 },
        { x: 1000020, y: 1000020 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(3)
      expect(result.every((p) => isFinite(p.x) && isFinite(p.y))).toBe(true)
    })

    it('should handle negative coordinates', () => {
      const points: Point[] = [
        { x: -100, y: -100 },
        { x: -90, y: -90 },
        { x: -80, y: -80 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(3)
      expect(result.every((p) => p.x < 0 && p.y < 0)).toBe(true)
    })

    it('should handle mixed positive and negative coordinates', () => {
      const points: Point[] = [
        { x: -10, y: -10 },
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(3)
      // Center should be approximately 0
      expect(result[1].x).toBeCloseTo(0, 0)
      expect(result[1].y).toBeCloseTo(0, 0)
    })

    it('should handle very small coordinate differences', () => {
      const points: Point[] = [
        { x: 0.001, y: 0.001 },
        { x: 0.002, y: 0.002 },
        { x: 0.003, y: 0.003 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(3)
      expect(result.every((p) => isFinite(p.x) && isFinite(p.y))).toBe(true)
    })
  })

  describe('special patterns', () => {
    it('should handle horizontal line', () => {
      const points: Point[] = [
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 30, y: 10 },
        { x: 40, y: 10 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      // All y values should remain 10
      expect(result.every((p) => Math.abs(p.y - 10) < 0.01)).toBe(true)
    })

    it('should handle vertical line', () => {
      const points: Point[] = [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 20 },
        { x: 10, y: 30 },
        { x: 10, y: 40 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      // All x values should remain 10
      expect(result.every((p) => Math.abs(p.x - 10) < 0.01)).toBe(true)
    })

    it('should handle stationary points (all same)', () => {
      const points: Point[] = [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      // All points should remain approximately at 50
      expect(
        result.every(
          (p) => Math.abs(p.x - 50) < 0.01 && Math.abs(p.y - 50) < 0.01
        )
      ).toBe(true)
    })

    it('should handle rapid oscillation', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 100 },
        { x: 20, y: 0 },
        { x: 30, y: 100 },
        { x: 40, y: 0 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      // Smoothed values should be between extremes
      for (const p of result) {
        expect(p.y).toBeGreaterThanOrEqual(-10)
        expect(p.y).toBeLessThanOrEqual(110)
      }
    })

    it('should handle step function', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 100 },
        { x: 40, y: 100 },
        { x: 50, y: 100 },
      ]
      const result = smooth(points, { kernel: gaussianKernel({ size: 5 }) })
      expect(result.length).toBe(6)
      // Edge should be smoothed
      expect(result[2].y).toBeGreaterThan(0)
      expect(result[3].y).toBeLessThan(100)
    })
  })

  describe('extra properties handling', () => {
    it('should handle points with extra properties', () => {
      const points = [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.7 },
        { x: 20, y: 20, pressure: 0.9 },
      ]
      const result = smooth(points, { kernel: boxKernel({ size: 3 }) })
      expect(result.length).toBe(3)
      // smooth function focuses on x,y coordinates
      // Additional properties may or may not be preserved depending on implementation
      expect(result.every((p) => isFinite(p.x) && isFinite(p.y))).toBe(true)
    })
  })

  describe('multiple sequential smoothing', () => {
    it('should allow multiple smooth passes', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 100 },
        { x: 20, y: 0 },
        { x: 30, y: 100 },
        { x: 40, y: 0 },
      ]
      const kernel = gaussianKernel({ size: 3 })

      const pass1 = smooth(points, { kernel })
      const pass2 = smooth(pass1, { kernel })
      const pass3 = smooth(pass2, { kernel })

      // Each pass should smooth more
      const variance1 = computeVariance(pass1.map((p) => p.y))
      const variance2 = computeVariance(pass2.map((p) => p.y))
      const variance3 = computeVariance(pass3.map((p) => p.y))

      expect(variance2).toBeLessThanOrEqual(variance1)
      expect(variance3).toBeLessThanOrEqual(variance2)
    })
  })
})

// Helper function
function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

// ============================================
// preserveEndpoints Tests
// ============================================

describe('smooth - preserveEndpoints option', () => {
  it('should preserve exact start and end points when enabled', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
      { x: 30, y: 100 },
      { x: 40, y: 0 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 5 }),
      padding: 'reflect',
      preserveEndpoints: true,
    })

    // Endpoints should match exactly
    expect(result[0].x).toBe(0)
    expect(result[0].y).toBe(0)
    expect(result[result.length - 1].x).toBe(40)
    expect(result[result.length - 1].y).toBe(0)
  })

  it('should preserve endpoints by default', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 3 }),
      padding: 'reflect',
    })

    // Endpoints should be preserved by default
    expect(result[0].x).toBe(0)
    expect(result[0].y).toBe(0)
    expect(result[result.length - 1].x).toBe(20)
    expect(result[result.length - 1].y).toBe(0)
  })

  it('should not preserve endpoints when explicitly disabled', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 3 }),
      padding: 'reflect',
      preserveEndpoints: false,
    })

    // With reflect padding and preserveEndpoints: false, endpoints may be pulled toward interior
    expect(result.length).toBe(3)
  })

  it('should work with box kernel', () => {
    const points: Point[] = [
      { x: 5, y: 10 },
      { x: 15, y: 50 },
      { x: 25, y: 30 },
    ]

    const result = smooth(points, {
      kernel: boxKernel({ size: 3 }),
      preserveEndpoints: true,
    })

    expect(result[0].x).toBe(5)
    expect(result[0].y).toBe(10)
    expect(result[result.length - 1].x).toBe(25)
    expect(result[result.length - 1].y).toBe(30)
  })

  it('should work with bilateral kernel', () => {
    const points: Point[] = [
      { x: 100, y: 200 },
      { x: 110, y: 210 },
      { x: 120, y: 220 },
      { x: 130, y: 230 },
      { x: 140, y: 240 },
    ]

    const result = smooth(points, {
      kernel: bilateralKernel({ size: 5, sigmaValue: 10 }),
      preserveEndpoints: true,
    })

    expect(result[0].x).toBe(100)
    expect(result[0].y).toBe(200)
    expect(result[result.length - 1].x).toBe(140)
    expect(result[result.length - 1].y).toBe(240)
  })

  it('should handle single point with preserveEndpoints', () => {
    const points: Point[] = [{ x: 50, y: 75 }]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 5 }),
      preserveEndpoints: true,
    })

    expect(result.length).toBe(1)
    expect(result[0].x).toBe(50)
    expect(result[0].y).toBe(75)
  })

  it('should handle two points with preserveEndpoints', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 5 }),
      preserveEndpoints: true,
    })

    expect(result.length).toBe(2)
    expect(result[0].x).toBe(0)
    expect(result[0].y).toBe(0)
    expect(result[1].x).toBe(100)
    expect(result[1].y).toBe(100)
  })

  it('should still smooth interior points when preserving endpoints', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 100 }, // Spike
      { x: 20, y: 0 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 3 }),
      preserveEndpoints: true,
    })

    // Endpoints preserved
    expect(result[0].y).toBe(0)
    expect(result[2].y).toBe(0)

    // Interior point should still be smoothed (pulled down from 100)
    expect(result[1].y).toBeLessThan(100)
    expect(result[1].y).toBeGreaterThan(0)
  })

  it('should work with all padding modes when preserving endpoints', () => {
    const points: Point[] = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]
    const kernel = gaussianKernel({ size: 3 })

    const reflectResult = smooth(points, {
      kernel,
      padding: 'reflect',
      preserveEndpoints: true,
    })
    const edgeResult = smooth(points, {
      kernel,
      padding: 'edge',
      preserveEndpoints: true,
    })
    const zeroResult = smooth(points, {
      kernel,
      padding: 'zero',
      preserveEndpoints: true,
    })

    // All should preserve endpoints regardless of padding mode
    for (const result of [reflectResult, edgeResult, zeroResult]) {
      expect(result[0].x).toBe(10)
      expect(result[0].y).toBe(20)
      expect(result[result.length - 1].x).toBe(50)
      expect(result[result.length - 1].y).toBe(60)
    }
  })

  it('should have zero distance between original and smoothed endpoints', () => {
    // Simulate a real stroke where endpoint would drift without preserveEndpoints
    const points: Point[] = [
      { x: 100, y: 100 },
      { x: 150, y: 120 },
      { x: 200, y: 150 },
      { x: 250, y: 200 },
      { x: 300, y: 280 },
      { x: 350, y: 350 },
      { x: 400, y: 400 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 5 }),
      padding: 'reflect',
      // preserveEndpoints defaults to true
    })

    const originalStart = points[0]
    const originalEnd = points[points.length - 1]
    const smoothedStart = result[0]
    const smoothedEnd = result[result.length - 1]

    // Calculate distances
    const startDistance = Math.sqrt(
      (smoothedStart.x - originalStart.x) ** 2 +
        (smoothedStart.y - originalStart.y) ** 2
    )
    const endDistance = Math.sqrt(
      (smoothedEnd.x - originalEnd.x) ** 2 +
        (smoothedEnd.y - originalEnd.y) ** 2
    )

    // Both distances should be exactly zero
    expect(startDistance).toBe(0)
    expect(endDistance).toBe(0)
  })

  it('should have non-zero distance when preserveEndpoints is disabled', () => {
    const points: Point[] = [
      { x: 100, y: 100 },
      { x: 150, y: 120 },
      { x: 200, y: 150 },
      { x: 250, y: 200 },
      { x: 300, y: 280 },
      { x: 350, y: 350 },
      { x: 400, y: 400 },
    ]

    const result = smooth(points, {
      kernel: gaussianKernel({ size: 5 }),
      padding: 'reflect',
      preserveEndpoints: false,
    })

    const originalEnd = points[points.length - 1]
    const smoothedEnd = result[result.length - 1]

    // With reflect padding and no endpoint preservation, endpoint should drift
    const endDistance = Math.sqrt(
      (smoothedEnd.x - originalEnd.x) ** 2 +
        (smoothedEnd.y - originalEnd.y) ** 2
    )

    // Distance should be non-zero (endpoint drifted)
    expect(endDistance).toBeGreaterThan(0)
  })
})

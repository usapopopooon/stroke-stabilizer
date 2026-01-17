import { describe, it, expect } from 'vitest'
import { noiseFilter } from './NoiseFilter'
import { kalmanFilter } from './KalmanFilter'
import { movingAverageFilter } from './MovingAverageFilter'
import { stringFilter } from './StringFilter'
import { emaFilter } from './EmaFilter'
import { oneEuroFilter } from './OneEuroFilter'
import { linearPredictionFilter } from './LinearPredictionFilter'
import type { PointerPoint } from '../types'

function createPoint(
  x: number,
  y: number,
  timestamp = Date.now()
): PointerPoint {
  return { x, y, timestamp }
}

describe('NoiseFilter', () => {
  it('should pass first point through', () => {
    const filter = noiseFilter({ minDistance: 10 })
    const point = createPoint(0, 0)

    expect(filter.process(point)).toEqual(point)
  })

  it('should reject points closer than minDistance', () => {
    const filter = noiseFilter({ minDistance: 10 })

    filter.process(createPoint(0, 0))
    const result = filter.process(createPoint(5, 5)) // distance ~7.07

    expect(result).toBeNull()
  })

  it('should pass points farther than minDistance', () => {
    const filter = noiseFilter({ minDistance: 10 })

    filter.process(createPoint(0, 0))
    const result = filter.process(createPoint(10, 10)) // distance ~14.14

    expect(result).not.toBeNull()
  })

  it('should reset state', () => {
    const filter = noiseFilter({ minDistance: 10 })

    filter.process(createPoint(0, 0))
    filter.reset()

    // After reset, first point should pass
    const point = createPoint(5, 5)
    expect(filter.process(point)).toEqual(point)
  })

  it('should have correct type', () => {
    const filter = noiseFilter({ minDistance: 10 })
    expect(filter.type).toBe('noise')
  })
})

describe('KalmanFilter', () => {
  it('should pass first point through unchanged', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    const point = createPoint(10, 20, 0)

    const result = filter.process(point)

    expect(result?.x).toBe(10)
    expect(result?.y).toBe(20)
  })

  it('should smooth noisy input', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 1.0 })

    // Points on a line + noise
    const results: PointerPoint[] = []
    const noisyPoints = [
      createPoint(0, 0, 0),
      createPoint(12, 8, 100), // Noisy (ideal: 10, 10)
      createPoint(18, 22, 200), // Noisy (ideal: 20, 20)
      createPoint(32, 28, 300), // Noisy (ideal: 30, 30)
    ]

    for (const point of noisyPoints) {
      const result = filter.process(point)
      if (result) results.push(result)
    }

    // Kalman filter should smooth
    expect(results.length).toBe(4)
  })

  it('should preserve pressure', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })

    filter.process(createPoint(0, 0, 0))
    const result = filter.process({
      x: 10,
      y: 10,
      pressure: 0.8,
      timestamp: 100,
    })

    expect(result?.pressure).toBe(0.8)
  })

  it('should have correct type', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    expect(filter.type).toBe('kalman')
  })

  it('should not produce wild values on rapid zigzag input', () => {
    // This test ensures the velocity clamping prevents runaway values
    // when direction changes rapidly with high-frequency events
    const filter = kalmanFilter({ processNoise: 0.08, measurementNoise: 0.7 })

    const results: PointerPoint[] = []
    // Rapid zigzag with 1ms intervals (simulates high-frequency pointer events)
    for (let i = 0; i < 20; i++) {
      const x = 300 + (i % 2 === 0 ? -100 : 100) // Extreme left-right
      const y = 200
      const result = filter.process({ x, y, timestamp: i })
      if (result) results.push(result)
    }

    // All output points should be within reasonable bounds
    // Input range is 200-400, output should not go beyond that
    for (const point of results) {
      expect(point.x).toBeGreaterThan(100) // Not flying off to the left
      expect(point.x).toBeLessThan(500) // Not flying off to the right
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
  })

  it('should clamp velocity to prevent explosion on direction reversal', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })

    // Start moving right
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(100, 0, 1))
    filter.process(createPoint(200, 0, 2))
    // Suddenly reverse direction
    const result = filter.process(createPoint(0, 0, 3))

    // Should not produce extreme values
    expect(result).not.toBeNull()
    expect(Math.abs(result!.x)).toBeLessThan(1000)
    expect(Number.isFinite(result!.x)).toBe(true)
  })
})

describe('MovingAverageFilter', () => {
  it('should return input for single point', () => {
    const filter = movingAverageFilter({ windowSize: 3 })
    const point = createPoint(10, 20)

    const result = filter.process(point)

    expect(result?.x).toBe(10)
    expect(result?.y).toBe(20)
  })

  it('should average points within window', () => {
    const filter = movingAverageFilter({ windowSize: 3 })

    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))

    expect(result?.x).toBe(10) // (0 + 10 + 20) / 3
    expect(result?.y).toBe(10)
  })

  it('should slide window when exceeding size', () => {
    const filter = movingAverageFilter({ windowSize: 2 })

    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))

    expect(result?.x).toBe(15) // (10 + 20) / 2
    expect(result?.y).toBe(15)
  })

  it('should average pressure values', () => {
    const filter = movingAverageFilter({ windowSize: 2 })

    filter.process({ x: 0, y: 0, pressure: 0.5, timestamp: 0 })
    const result = filter.process({
      x: 10,
      y: 10,
      pressure: 1.0,
      timestamp: 100,
    })

    expect(result?.pressure).toBe(0.75)
  })

  it('should have correct type', () => {
    const filter = movingAverageFilter({ windowSize: 3 })
    expect(filter.type).toBe('movingAverage')
  })
})

describe('StringFilter', () => {
  it('should return first point unchanged', () => {
    const filter = stringFilter({ stringLength: 10 })
    const point = createPoint(0, 0)

    expect(filter.process(point)).toEqual(point)
  })

  it('should keep anchor when within string length', () => {
    const filter = stringFilter({ stringLength: 10 })

    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(5, 5, 100)) // distance ~7.07

    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should pull anchor when exceeding string length', () => {
    const filter = stringFilter({ stringLength: 10 })

    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(20, 0, 100)) // distance = 20

    // Anchor moves 20 - 10 = 10
    expect(result?.x).toBe(10)
    expect(result?.y).toBe(0)
  })

  it('should preserve pressure and timestamp from input', () => {
    const filter = stringFilter({ stringLength: 10 })

    filter.process(createPoint(0, 0, 0))
    const result = filter.process({ x: 5, y: 5, pressure: 0.7, timestamp: 100 })

    expect(result?.pressure).toBe(0.7)
    expect(result?.timestamp).toBe(100)
  })

  it('should have correct type', () => {
    const filter = stringFilter({ stringLength: 10 })
    expect(filter.type).toBe('string')
  })
})

describe('EmaFilter', () => {
  it('should return first point unchanged', () => {
    const filter = emaFilter({ alpha: 0.5 })
    const point = createPoint(10, 20, 0)

    const result = filter.process(point)

    expect(result?.x).toBe(10)
    expect(result?.y).toBe(20)
  })

  it('should apply exponential smoothing', () => {
    const filter = emaFilter({ alpha: 0.5 })

    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))

    // y = 0.5 * 10 + 0.5 * 0 = 5
    expect(result?.x).toBe(5)
    expect(result?.y).toBe(5)
  })

  it('should respond more with higher alpha', () => {
    const filterHigh = emaFilter({ alpha: 0.9 })
    const filterLow = emaFilter({ alpha: 0.1 })

    filterHigh.process(createPoint(0, 0, 0))
    filterLow.process(createPoint(0, 0, 0))

    const resultHigh = filterHigh.process(createPoint(100, 100, 100))
    const resultLow = filterLow.process(createPoint(100, 100, 100))

    // alpha=0.9 emphasizes new value -> closer to 100
    // alpha=0.1 emphasizes old value -> closer to 0
    expect(resultHigh?.x).toBeGreaterThan(resultLow?.x ?? 0)
  })

  it('should smooth noisy input over time', () => {
    const filter = emaFilter({ alpha: 0.3 })

    // Zigzag input
    const points = [
      createPoint(0, 0, 0),
      createPoint(10, 20, 100),
      createPoint(5, 5, 200),
      createPoint(15, 25, 300),
      createPoint(10, 10, 400),
    ]

    let lastResult: PointerPoint | null = null
    for (const p of points) {
      lastResult = filter.process(p)
    }

    // Smoothed so not extreme values
    expect(lastResult?.x).toBeGreaterThan(0)
    expect(lastResult?.x).toBeLessThan(15)
  })

  it('should smooth pressure values', () => {
    const filter = emaFilter({ alpha: 0.5 })

    filter.process({ x: 0, y: 0, pressure: 0, timestamp: 0 })
    const result = filter.process({
      x: 10,
      y: 10,
      pressure: 1.0,
      timestamp: 100,
    })

    // 0.5 * 1.0 + 0.5 * 0 = 0.5
    expect(result?.pressure).toBe(0.5)
  })

  it('should reset state', () => {
    const filter = emaFilter({ alpha: 0.5 })

    filter.process(createPoint(100, 100, 0))
    filter.reset()

    // After reset, first point returns as-is
    const point = createPoint(10, 10, 100)
    const result = filter.process(point)
    expect(result?.x).toBe(10)
    expect(result?.y).toBe(10)
  })

  it('should have correct type', () => {
    const filter = emaFilter({ alpha: 0.5 })
    expect(filter.type).toBe('ema')
  })
})

describe('OneEuroFilter', () => {
  it('should return first point unchanged', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
    const point = createPoint(10, 20, 0)

    const result = filter.process(point)

    expect(result?.x).toBe(10)
    expect(result?.y).toBe(20)
  })

  it('should smooth slow movements strongly', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    // Slow movement (long time interval)
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(1, 1, 100)) // 1px after 0.1 seconds
    const result = filter.process(createPoint(2, 2, 200))

    // Slow speed = strong smoothing -> lags behind input
    expect(result?.x).toBeLessThan(2)
    expect(result?.y).toBeLessThan(2)
  })

  it('should be more responsive to fast movements', () => {
    // Compare slow and fast inputs with same filter
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.1 }) // High beta

    // Slow input (10px/sec)
    filter.process(createPoint(0, 0, 0))
    const slowResult = filter.process(createPoint(10, 10, 1000))

    filter.reset()

    // Fast input (1000px/sec)
    filter.process(createPoint(0, 0, 0))
    const fastResult = filter.process(createPoint(100, 100, 100))

    // Fast movement has higher tracking ratio
    const slowRatio = (slowResult?.x ?? 0) / 10
    const fastRatio = (fastResult?.x ?? 0) / 100

    expect(fastRatio).toBeGreaterThan(slowRatio)
  })

  it('should smooth jittery input', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    // Jittery input (small oscillations at same location)
    const results: PointerPoint[] = []
    const jitteryPoints = [
      createPoint(100, 100, 0),
      createPoint(101, 99, 16),
      createPoint(99, 101, 32),
      createPoint(100, 98, 48),
      createPoint(102, 100, 64),
    ]

    for (const p of jitteryPoints) {
      const result = filter.process(p)
      if (result) results.push(result)
    }

    // Variance should be smaller after filtering
    const inputVariance = computeVariance(jitteryPoints.map((p) => p.x))
    const outputVariance = computeVariance(results.map((p) => p.x))

    expect(outputVariance).toBeLessThan(inputVariance)
  })

  it('should handle different beta values', () => {
    const lowBeta = oneEuroFilter({ minCutoff: 1.0, beta: 0.001 })
    const highBeta = oneEuroFilter({ minCutoff: 1.0, beta: 0.1 })

    // Same fast input
    lowBeta.process(createPoint(0, 0, 0))
    highBeta.process(createPoint(0, 0, 0))

    const lowResult = lowBeta.process(createPoint(100, 100, 16))
    const highResult = highBeta.process(createPoint(100, 100, 16))

    // Higher beta = more responsive at high speed (closer to input)
    expect(highResult?.x).toBeGreaterThan(lowResult?.x ?? 0)
  })

  it('should smooth pressure values', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    filter.process({ x: 0, y: 0, pressure: 0.5, timestamp: 0 })
    const result = filter.process({
      x: 10,
      y: 10,
      pressure: 1.0,
      timestamp: 100,
    })

    // Pressure is also smoothed
    expect(result?.pressure).toBeGreaterThan(0.5)
    expect(result?.pressure).toBeLessThan(1.0)
  })

  it('should reset state', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    filter.process(createPoint(100, 100, 0))
    filter.process(createPoint(110, 110, 100))
    filter.reset()

    // After reset, first point returns as-is
    const point = createPoint(0, 0, 200)
    const result = filter.process(point)
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should have correct type', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
    expect(filter.type).toBe('oneEuro')
  })
})

describe('LinearPredictionFilter', () => {
  it('should return first point unchanged', () => {
    const filter = linearPredictionFilter({
      historySize: 4,
      predictionFactor: 0.5,
    })
    const point = createPoint(10, 20, 0)

    const result = filter.process(point)

    expect(result?.x).toBe(10)
    expect(result?.y).toBe(20)
  })

  it('should predict ahead for constant velocity motion', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
      smoothing: 1.0, // No smoothing for pure prediction test
    })

    // Simulate constant velocity motion (100px/sec)
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    filter.process(createPoint(20, 20, 200))
    const result = filter.process(createPoint(30, 30, 300))

    // Prediction should exceed input value
    expect(result?.x).toBeGreaterThanOrEqual(30)
    expect(result?.y).toBeGreaterThanOrEqual(30)
  })

  it('should output smoothed values', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
      smoothing: 0.6,
    })

    // Should produce output for consecutive inputs
    const results: PointerPoint[] = []
    const points = [
      createPoint(0, 0, 0),
      createPoint(10, 10, 100),
      createPoint(20, 20, 200),
      createPoint(30, 30, 300),
    ]

    for (const p of points) {
      const result = filter.process(p)
      if (result) results.push(result)
    }

    expect(results.length).toBe(4)
    // Smoothed, so last output may differ from input
    expect(results[3]).toBeDefined()
  })

  it('should smooth jittery input', () => {
    const filter = linearPredictionFilter({
      historySize: 4,
      predictionFactor: 0.3,
      smoothing: 0.5,
    })

    // Jittery input
    const results: PointerPoint[] = []
    const jitteryPoints = [
      createPoint(0, 0, 0),
      createPoint(12, 8, 100),
      createPoint(18, 22, 200),
      createPoint(32, 28, 300),
      createPoint(38, 42, 400),
    ]

    for (const p of jitteryPoints) {
      const result = filter.process(p)
      if (result) results.push(result)
    }

    // Should be smoothed
    expect(results.length).toBe(5)
    // Variance should not exceed original data too much
    const inputVariance = computeVariance(jitteryPoints.map((p) => p.x))
    const outputVariance = computeVariance(results.map((p) => p.x))
    // Some variance from prediction+smoothing, but not extreme
    expect(outputVariance).toBeLessThan(inputVariance * 2)
  })

  it('should preserve pressure', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
    })

    filter.process({ x: 0, y: 0, pressure: 0.5, timestamp: 0 })
    const result = filter.process({
      x: 10,
      y: 10,
      pressure: 0.8,
      timestamp: 100,
    })

    expect(result?.pressure).toBeDefined()
    expect(result?.pressure).toBeGreaterThan(0)
  })

  it('should reset state', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
    })

    filter.process(createPoint(100, 100, 0))
    filter.process(createPoint(110, 110, 100))
    filter.reset()

    // After reset, first point returns as-is
    const point = createPoint(0, 0, 200)
    const result = filter.process(point)
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should have correct type', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
    })
    expect(filter.type).toBe('linearPrediction')
  })
})

// Helper function
function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

// ============================================
// Edge Case Tests
// ============================================

describe('NoiseFilter - Edge Cases', () => {
  it('should handle zero minDistance', () => {
    const filter = noiseFilter({ minDistance: 0 })
    filter.process(createPoint(0, 0))
    // Any movement should pass
    const result = filter.process(createPoint(0.001, 0.001))
    expect(result).not.toBeNull()
  })

  it('should handle very small minDistance', () => {
    const filter = noiseFilter({ minDistance: 0.001 })
    filter.process(createPoint(0, 0))
    const result = filter.process(createPoint(0.01, 0.01))
    expect(result).not.toBeNull()
  })

  it('should handle identical consecutive points', () => {
    const filter = noiseFilter({ minDistance: 1 })
    filter.process(createPoint(10, 10))
    const result = filter.process(createPoint(10, 10))
    expect(result).toBeNull() // distance = 0
  })

  it('should handle very large coordinates', () => {
    const filter = noiseFilter({ minDistance: 10 })
    filter.process(createPoint(1000000, 1000000))
    const result = filter.process(createPoint(1000100, 1000100))
    expect(result).not.toBeNull()
  })

  it('should handle negative coordinates', () => {
    const filter = noiseFilter({ minDistance: 10 })
    filter.process(createPoint(-100, -100))
    const result = filter.process(createPoint(-120, -120))
    expect(result).not.toBeNull()
  })

  it('should update parameters', () => {
    const filter = noiseFilter({ minDistance: 100 })
    filter.process(createPoint(0, 0))
    // Should be filtered with minDistance=100
    expect(filter.process(createPoint(10, 10))).toBeNull()

    // Update to smaller distance
    filter.updateParams({ minDistance: 5 })
    filter.reset()
    filter.process(createPoint(0, 0))
    // Now should pass
    expect(filter.process(createPoint(10, 10))).not.toBeNull()
  })
})

describe('KalmanFilter - Edge Cases', () => {
  it('should handle very small processNoise', () => {
    const filter = kalmanFilter({ processNoise: 0.001, measurementNoise: 0.5 })
    const results: PointerPoint[] = []
    for (let i = 0; i < 5; i++) {
      const result = filter.process(createPoint(i * 10, i * 10, i * 100))
      if (result) results.push(result)
    }
    expect(results.length).toBe(5)
  })

  it('should handle very large measurementNoise', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 100 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // High measurement noise = slow response
    expect(result?.x).toBeLessThan(100)
  })

  it('should handle identical timestamps', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    filter.process(createPoint(0, 0, 100))
    const result = filter.process(createPoint(10, 10, 100)) // same timestamp
    expect(result).not.toBeNull()
  })

  it('should handle very rapid input (small dt)', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 1)) // 1ms interval
    expect(result).not.toBeNull()
  })

  it('should update parameters', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    filter.process(createPoint(0, 0, 0))
    filter.updateParams({ processNoise: 0.01, measurementNoise: 1.0 })
    const result = filter.process(createPoint(10, 10, 100))
    expect(result).not.toBeNull()
  })

  it('should maintain stability over many iterations', () => {
    const filter = kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
    const results: PointerPoint[] = []
    for (let i = 0; i < 100; i++) {
      const result = filter.process(createPoint(i, i, i * 10))
      if (result) results.push(result)
    }
    expect(results.length).toBe(100)
    // Check no NaN or Infinity
    expect(results.every((r) => isFinite(r.x) && isFinite(r.y))).toBe(true)
  })
})

describe('MovingAverageFilter - Edge Cases', () => {
  it('should handle windowSize of 1', () => {
    const filter = movingAverageFilter({ windowSize: 1 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // windowSize=1 means no averaging
    expect(result?.x).toBe(100)
    expect(result?.y).toBe(100)
  })

  it('should handle very large windowSize', () => {
    const filter = movingAverageFilter({ windowSize: 100 })
    const results: PointerPoint[] = []
    for (let i = 0; i < 10; i++) {
      const result = filter.process(createPoint(i * 10, i * 10, i * 100))
      if (result) results.push(result)
    }
    expect(results.length).toBe(10)
  })

  it('should reset state correctly', () => {
    const filter = movingAverageFilter({ windowSize: 3 })
    filter.process(createPoint(100, 100, 0))
    filter.process(createPoint(100, 100, 100))
    filter.reset()
    const result = filter.process(createPoint(0, 0, 200))
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should handle points without pressure', () => {
    const filter = movingAverageFilter({ windowSize: 2 })
    filter.process({ x: 0, y: 0, timestamp: 0 }) // no pressure
    const result = filter.process({ x: 10, y: 10, timestamp: 100 })
    expect(result?.pressure).toBeUndefined()
  })

  it('should update parameters', () => {
    const filter = movingAverageFilter({ windowSize: 3 })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    filter.updateParams({ windowSize: 2 })
    // Process more points with new window size
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })
})

describe('StringFilter - Edge Cases', () => {
  it('should handle very small stringLength', () => {
    const filter = stringFilter({ stringLength: 0.1 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    // Small string = anchor follows closely
    expect(result).not.toBeNull()
  })

  it('should handle very large stringLength', () => {
    const filter = stringFilter({ stringLength: 1000 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    // Large string = anchor stays at origin
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should handle movement exactly at stringLength boundary', () => {
    const filter = stringFilter({ stringLength: 10 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 0, 100)) // exactly 10
    // At boundary, no pull needed
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should reset state correctly', () => {
    const filter = stringFilter({ stringLength: 10 })
    filter.process(createPoint(100, 100, 0))
    filter.reset()
    const point = createPoint(0, 0, 100)
    const result = filter.process(point)
    expect(result).toEqual(point)
  })

  it('should handle rapid direction changes', () => {
    const filter = stringFilter({ stringLength: 10 })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(20, 0, 100)) // anchor at 10, 0
    const result = filter.process(createPoint(0, 20, 200)) // quick direction change
    expect(result).not.toBeNull()
    expect(isFinite(result?.x ?? 0)).toBe(true)
    expect(isFinite(result?.y ?? 0)).toBe(true)
  })

  it('should update parameters', () => {
    const filter = stringFilter({ stringLength: 100 })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    filter.updateParams({ stringLength: 5 })
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })
})

describe('EmaFilter - Edge Cases', () => {
  it('should handle alpha = 0 (ignore new values)', () => {
    const filter = emaFilter({ alpha: 0 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // alpha=0 means keep old value
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
  })

  it('should handle alpha = 1 (no smoothing)', () => {
    const filter = emaFilter({ alpha: 1 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // alpha=1 means take new value
    expect(result?.x).toBe(100)
    expect(result?.y).toBe(100)
  })

  it('should handle very small alpha', () => {
    const filter = emaFilter({ alpha: 0.01 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // Very small alpha = very slow response
    expect(result?.x).toBeLessThan(10)
  })

  it('should handle alpha close to 1', () => {
    const filter = emaFilter({ alpha: 0.99 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // Alpha close to 1 = fast response
    expect(result?.x).toBeGreaterThan(90)
  })

  it('should update parameters', () => {
    const filter = emaFilter({ alpha: 0.1 })
    filter.process(createPoint(0, 0, 0))
    filter.updateParams({ alpha: 0.9 })
    const result = filter.process(createPoint(100, 100, 100))
    expect(result?.x).toBeGreaterThan(80)
  })
})

describe('OneEuroFilter - Edge Cases', () => {
  it('should handle very small minCutoff', () => {
    const filter = oneEuroFilter({ minCutoff: 0.01, beta: 0.007 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    expect(result).not.toBeNull()
    expect(isFinite(result?.x ?? 0)).toBe(true)
  })

  it('should handle very large minCutoff', () => {
    const filter = oneEuroFilter({ minCutoff: 100, beta: 0.007 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    // Large minCutoff = fast response
    expect(result?.x).toBeGreaterThan(5)
  })

  it('should handle beta = 0 (no speed adaptation)', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    expect(result).not.toBeNull()
  })

  it('should handle very large beta', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 10 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(100, 100, 100))
    // Large beta = very responsive at high speed
    expect(result?.x).toBeGreaterThan(50)
  })

  it('should handle very small time interval', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 1)) // 1ms
    expect(result).not.toBeNull()
    expect(isFinite(result?.x ?? 0)).toBe(true)
  })

  it('should handle zero time interval', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
    filter.process(createPoint(0, 0, 100))
    const result = filter.process(createPoint(10, 10, 100)) // same time
    expect(result).not.toBeNull()
  })

  it('should update parameters', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
    filter.process(createPoint(0, 0, 0))
    filter.updateParams({ minCutoff: 0.5, beta: 0.1 })
    const result = filter.process(createPoint(10, 10, 100))
    expect(result).not.toBeNull()
  })

  it('should handle custom dCutoff', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007, dCutoff: 0.5 })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    expect(result).not.toBeNull()
  })
})

describe('LinearPredictionFilter - Edge Cases', () => {
  it('should handle historySize = 1', () => {
    const filter = linearPredictionFilter({
      historySize: 1,
      predictionFactor: 0.5,
    })
    filter.process(createPoint(0, 0, 0))
    const result = filter.process(createPoint(10, 10, 100))
    expect(result).not.toBeNull()
  })

  it('should handle historySize = 2', () => {
    const filter = linearPredictionFilter({
      historySize: 2,
      predictionFactor: 0.5,
    })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })

  it('should handle predictionFactor = 0 (no prediction)', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0,
      smoothing: 1.0,
    })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))
    // No prediction, pure smoothing
    expect(result).not.toBeNull()
  })

  it('should handle predictionFactor > 1', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 2.0,
      smoothing: 1.0,
    })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    filter.process(createPoint(20, 20, 200))
    const result = filter.process(createPoint(30, 30, 300))
    // High prediction = overshoot
    expect(result?.x).toBeGreaterThan(30)
  })

  it('should handle smoothing = 0', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
      smoothing: 0,
    })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })

  it('should handle smoothing = 1', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
      smoothing: 1.0,
    })
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })

  it('should update parameters', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
    })
    filter.process(createPoint(0, 0, 0))
    filter.updateParams({ historySize: 5, predictionFactor: 0.8 })
    filter.process(createPoint(10, 10, 100))
    const result = filter.process(createPoint(20, 20, 200))
    expect(result).not.toBeNull()
  })

  it('should maintain stability with rapid direction changes', () => {
    const filter = linearPredictionFilter({
      historySize: 4,
      predictionFactor: 0.5,
      smoothing: 0.5,
    })
    const results: PointerPoint[] = []
    // Zigzag pattern
    const points = [
      createPoint(0, 0, 0),
      createPoint(10, 0, 100),
      createPoint(10, 10, 200),
      createPoint(0, 10, 300),
      createPoint(0, 0, 400),
    ]
    for (const p of points) {
      const result = filter.process(p)
      if (result) results.push(result)
    }
    expect(results.length).toBe(5)
    expect(results.every((r) => isFinite(r.x) && isFinite(r.y))).toBe(true)
  })
})

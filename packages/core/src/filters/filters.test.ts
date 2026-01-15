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

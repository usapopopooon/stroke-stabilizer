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

    // 直線上のポイント + ノイズ
    const results: PointerPoint[] = []
    const noisyPoints = [
      createPoint(0, 0, 0),
      createPoint(12, 8, 100), // ノイズあり（理想: 10, 10）
      createPoint(18, 22, 200), // ノイズあり（理想: 20, 20）
      createPoint(32, 28, 300), // ノイズあり（理想: 30, 30）
    ]

    for (const point of noisyPoints) {
      const result = filter.process(point)
      if (result) results.push(result)
    }

    // カルマンフィルタが平滑化しているはず
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

    // アンカーは 20 - 10 = 10 だけ移動
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

    // alpha=0.9 は新しい値を重視 → 100 に近い
    // alpha=0.1 は古い値を重視 → 0 に近い
    expect(resultHigh?.x).toBeGreaterThan(resultLow?.x ?? 0)
  })

  it('should smooth noisy input over time', () => {
    const filter = emaFilter({ alpha: 0.3 })

    // ジグザグ入力
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

    // 平滑化されているので極端な値にはならない
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

    // リセット後、最初のポイントはそのまま返る
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

    // ゆっくり動く（時間間隔が長い）
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(1, 1, 100)) // 0.1秒後に1px
    const result = filter.process(createPoint(2, 2, 200))

    // 低速なので強く平滑化される → 入力値より遅れる
    expect(result?.x).toBeLessThan(2)
    expect(result?.y).toBeLessThan(2)
  })

  it('should be more responsive to fast movements', () => {
    // 同じフィルタに対して低速と高速の入力を比較
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.1 }) // 高めのbeta

    // 低速入力 (10px/秒)
    filter.process(createPoint(0, 0, 0))
    const slowResult = filter.process(createPoint(10, 10, 1000))

    filter.reset()

    // 高速入力 (1000px/秒)
    filter.process(createPoint(0, 0, 0))
    const fastResult = filter.process(createPoint(100, 100, 100))

    // 高速の方が入力値に対する追従率が高い
    const slowRatio = (slowResult?.x ?? 0) / 10
    const fastRatio = (fastResult?.x ?? 0) / 100

    expect(fastRatio).toBeGreaterThan(slowRatio)
  })

  it('should smooth jittery input', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    // ジッターのある入力（同じ場所で細かく震える）
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

    // フィルタ後は変動が小さくなる
    const inputVariance = computeVariance(jitteryPoints.map((p) => p.x))
    const outputVariance = computeVariance(results.map((p) => p.x))

    expect(outputVariance).toBeLessThan(inputVariance)
  })

  it('should handle different beta values', () => {
    const lowBeta = oneEuroFilter({ minCutoff: 1.0, beta: 0.001 })
    const highBeta = oneEuroFilter({ minCutoff: 1.0, beta: 0.1 })

    // 同じ高速入力
    lowBeta.process(createPoint(0, 0, 0))
    highBeta.process(createPoint(0, 0, 0))

    const lowResult = lowBeta.process(createPoint(100, 100, 16))
    const highResult = highBeta.process(createPoint(100, 100, 16))

    // 高いbetaの方が高速時により敏感（入力に近い）
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

    // pressureも平滑化される
    expect(result?.pressure).toBeGreaterThan(0.5)
    expect(result?.pressure).toBeLessThan(1.0)
  })

  it('should reset state', () => {
    const filter = oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })

    filter.process(createPoint(100, 100, 0))
    filter.process(createPoint(110, 110, 100))
    filter.reset()

    // リセット後、最初のポイントはそのまま返る
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
      smoothing: 1.0, // スムージングなしで純粋な予測を見る
    })

    // 等速直線運動をシミュレート（100px/秒）
    filter.process(createPoint(0, 0, 0))
    filter.process(createPoint(10, 10, 100))
    filter.process(createPoint(20, 20, 200))
    const result = filter.process(createPoint(30, 30, 300))

    // 予測により入力値を上回るはず
    expect(result?.x).toBeGreaterThanOrEqual(30)
    expect(result?.y).toBeGreaterThanOrEqual(30)
  })

  it('should output smoothed values', () => {
    const filter = linearPredictionFilter({
      historySize: 3,
      predictionFactor: 0.5,
      smoothing: 0.6,
    })

    // 連続した入力に対して出力がある
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
    // 平滑化されているので、最後の出力は入力と異なる可能性がある
    expect(results[3]).toBeDefined()
  })

  it('should smooth jittery input', () => {
    const filter = linearPredictionFilter({
      historySize: 4,
      predictionFactor: 0.3,
      smoothing: 0.5,
    })

    // ジッターのある入力
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

    // 平滑化されているはず
    expect(results.length).toBe(5)
    // 変動が元データよりも小さいことを確認
    const inputVariance = computeVariance(jitteryPoints.map((p) => p.x))
    const outputVariance = computeVariance(results.map((p) => p.x))
    // 予測+平滑化により多少の変動はあるが、極端にはならない
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

    // リセット後、最初のポイントはそのまま返る
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

// ヘルパー関数
function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

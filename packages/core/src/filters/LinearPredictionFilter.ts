import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface LinearPredictionFilterParams {
  /**
   * Number of points used for prediction
   * More points = more stable but higher computation cost
   * Recommended: 3-5
   */
  historySize: number
  /**
   * Prediction strength (0-1)
   * - 0: No prediction (returns current position as-is)
   * - 1: Full prediction (maximally considers velocity/acceleration)
   * Recommended: 0.3-0.7
   */
  predictionFactor: number
  /**
   * Smoothing coefficient (0-1)
   * EMA coefficient applied to prediction output
   * Recommended: 0.5-0.8
   */
  smoothing?: number
}

const FILTER_TYPE = 'linearPrediction' as const

/**
 * Linear prediction filter
 *
 * Compensates for filter-induced latency by calculating velocity and
 * acceleration from past positions to predict the next position.
 *
 * Method:
 * 1. Estimate velocity and acceleration from past N points using least squares
 * 2. Predicted position = current position + velocity * Δt + 0.5 * acceleration * Δt²
 * 3. Blend current position and predicted position using prediction factor
 */
class LinearPredictionFilterImpl implements UpdatableFilter<LinearPredictionFilterParams> {
  readonly type = FILTER_TYPE
  private params: LinearPredictionFilterParams
  private history: PointerPoint[] = []
  private lastOutput: PointerPoint | null = null

  constructor(params: LinearPredictionFilterParams) {
    this.params = {
      smoothing: 0.6,
      ...params,
    }
  }

  process(point: PointerPoint): PointerPoint | null {
    this.history.push(point)

    // Remove old entries when history exceeds historySize+1
    while (this.history.length > this.params.historySize + 1) {
      this.history.shift()
    }

    // Return first point as-is
    if (this.history.length === 1) {
      this.lastOutput = point
      return point
    }

    // Estimate velocity and acceleration
    const { velocity, acceleration } = this.estimateMotion()

    // Calculate time delta (in seconds)
    const dt =
      this.history.length >= 2
        ? (this.history[this.history.length - 1].timestamp -
            this.history[this.history.length - 2].timestamp) /
          1000
        : 1 / 60 // Default 60fps

    // Calculate predicted position
    const { predictionFactor } = this.params
    const predictedX =
      point.x +
      velocity.x * dt * predictionFactor +
      0.5 * acceleration.x * dt * dt * predictionFactor
    const predictedY =
      point.y +
      velocity.y * dt * predictionFactor +
      0.5 * acceleration.y * dt * dt * predictionFactor

    // Apply smoothing
    let outputX = predictedX
    let outputY = predictedY
    let outputPressure = point.pressure

    if (this.lastOutput !== null && this.params.smoothing !== undefined) {
      const s = this.params.smoothing
      outputX = s * predictedX + (1 - s) * this.lastOutput.x
      outputY = s * predictedY + (1 - s) * this.lastOutput.y

      if (
        point.pressure !== undefined &&
        this.lastOutput.pressure !== undefined
      ) {
        outputPressure = s * point.pressure + (1 - s) * this.lastOutput.pressure
      }
    }

    this.lastOutput = {
      x: outputX,
      y: outputY,
      pressure: outputPressure,
      timestamp: point.timestamp,
    }

    return this.lastOutput
  }

  /**
   * Estimate velocity and acceleration using least squares
   */
  private estimateMotion(): {
    velocity: { x: number; y: number }
    acceleration: { x: number; y: number }
  } {
    const n = this.history.length
    if (n < 2) {
      return {
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      }
    }

    // Normalize time (first point = 0)
    const t0 = this.history[0].timestamp
    const times = this.history.map((p) => (p.timestamp - t0) / 1000)
    const xs = this.history.map((p) => p.x)
    const ys = this.history.map((p) => p.y)

    if (n === 2) {
      // Simple velocity calculation for 2 points
      const dt = times[1] - times[0]
      if (dt <= 0) {
        return { velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } }
      }
      return {
        velocity: {
          x: (xs[1] - xs[0]) / dt,
          y: (ys[1] - ys[0]) / dt,
        },
        acceleration: { x: 0, y: 0 },
      }
    }

    // For 3+ points, use quadratic polynomial fitting
    // x(t) = a + b*t + c*t^2
    // velocity = b + 2*c*t
    // acceleration = 2*c

    const fitX = this.polynomialFit(times, xs)
    const fitY = this.polynomialFit(times, ys)

    const lastT = times[times.length - 1]

    return {
      velocity: {
        x: fitX.b + 2 * fitX.c * lastT,
        y: fitY.b + 2 * fitY.c * lastT,
      },
      acceleration: {
        x: 2 * fitX.c,
        y: 2 * fitY.c,
      },
    }
  }

  /**
   * Quadratic polynomial least squares fitting
   * y = a + b*x + c*x^2
   */
  private polynomialFit(
    x: number[],
    y: number[]
  ): { a: number; b: number; c: number } {
    const n = x.length

    // Build normal equation coefficient matrix
    let sumX = 0,
      sumX2 = 0,
      sumX3 = 0,
      sumX4 = 0
    let sumY = 0,
      sumXY = 0,
      sumX2Y = 0

    for (let i = 0; i < n; i++) {
      const xi = x[i]
      const yi = y[i]
      const xi2 = xi * xi
      sumX += xi
      sumX2 += xi2
      sumX3 += xi2 * xi
      sumX4 += xi2 * xi2
      sumY += yi
      sumXY += xi * yi
      sumX2Y += xi2 * yi
    }

    // Solve system of equations (Cramer's rule)
    // [n,     sumX,   sumX2 ] [a]   [sumY  ]
    // [sumX,  sumX2,  sumX3 ] [b] = [sumXY ]
    // [sumX2, sumX3,  sumX4 ] [c]   [sumX2Y]

    const det =
      n * (sumX2 * sumX4 - sumX3 * sumX3) -
      sumX * (sumX * sumX4 - sumX3 * sumX2) +
      sumX2 * (sumX * sumX3 - sumX2 * sumX2)

    if (Math.abs(det) < 1e-10) {
      // Fall back to linear fit if matrix is singular
      const avgX = sumX / n
      const avgY = sumY / n
      let num = 0,
        den = 0
      for (let i = 0; i < n; i++) {
        num += (x[i] - avgX) * (y[i] - avgY)
        den += (x[i] - avgX) * (x[i] - avgX)
      }
      const b = den > 0 ? num / den : 0
      const a = avgY - b * avgX
      return { a, b, c: 0 }
    }

    const a =
      (sumY * (sumX2 * sumX4 - sumX3 * sumX3) -
        sumX * (sumXY * sumX4 - sumX3 * sumX2Y) +
        sumX2 * (sumXY * sumX3 - sumX2 * sumX2Y)) /
      det

    const b =
      (n * (sumXY * sumX4 - sumX3 * sumX2Y) -
        sumY * (sumX * sumX4 - sumX3 * sumX2) +
        sumX2 * (sumX * sumX2Y - sumXY * sumX2)) /
      det

    const c =
      (n * (sumX2 * sumX2Y - sumXY * sumX3) -
        sumX * (sumX * sumX2Y - sumXY * sumX2) +
        sumY * (sumX * sumX3 - sumX2 * sumX2)) /
      det

    return { a, b, c }
  }

  updateParams(params: Partial<LinearPredictionFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.history = []
    this.lastOutput = null
  }
}

/**
 * Create a linear prediction filter
 *
 * Compensates for filter-induced latency by estimating velocity and
 * acceleration from past positions to predict the next position.
 *
 * @example
 * ```ts
 * // Standard settings
 * const pointer = new StabilizedPointer()
 *   .addFilter(linearPredictionFilter({
 *     historySize: 4,
 *     predictionFactor: 0.5
 *   }))
 *
 * // Strong prediction (prioritize latency reduction)
 * const responsive = linearPredictionFilter({
 *   historySize: 3,
 *   predictionFactor: 0.8,
 *   smoothing: 0.7
 * })
 *
 * // Stability focused
 * const stable = linearPredictionFilter({
 *   historySize: 5,
 *   predictionFactor: 0.3,
 *   smoothing: 0.5
 * })
 * ```
 */
export function linearPredictionFilter(
  params: LinearPredictionFilterParams
): Filter {
  return new LinearPredictionFilterImpl(params)
}

import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface KalmanFilterParams {
  /** Process noise (Q): Lower values trust prediction more */
  processNoise: number
  /** Measurement noise (R): Higher values result in stronger smoothing */
  measurementNoise: number
}

interface KalmanState {
  x: number
  y: number
  p: number // covariance
  lastTimestamp: number
}

const FILTER_TYPE = 'kalman' as const

/**
 * Kalman filter
 *
 * Simple position-only Kalman filter for smooth cursor tracking.
 * Uses prediction from previous position (no velocity) to avoid runaway behavior.
 */
class KalmanFilterImpl implements UpdatableFilter<KalmanFilterParams> {
  readonly type = FILTER_TYPE
  private params: KalmanFilterParams
  private state: KalmanState | null = null

  constructor(params: KalmanFilterParams) {
    this.params = { ...params }
  }

  process(point: PointerPoint): PointerPoint | null {
    if (this.state === null) {
      this.state = {
        x: point.x,
        y: point.y,
        p: 1,
        lastTimestamp: point.timestamp,
      }
      return point
    }

    const { processNoise: Q, measurementNoise: R } = this.params

    // Prediction step: assume position stays the same (no velocity model)
    const predictedX = this.state.x
    const predictedY = this.state.y
    const predictedP = this.state.p + Q

    // Update step (calculate Kalman gain)
    const K = predictedP / (predictedP + R)

    // State update: blend prediction with measurement
    const newX = predictedX + K * (point.x - predictedX)
    const newY = predictedY + K * (point.y - predictedY)
    const newP = (1 - K) * predictedP

    this.state = {
      x: newX,
      y: newY,
      p: newP,
      lastTimestamp: point.timestamp,
    }

    return {
      x: newX,
      y: newY,
      pressure: point.pressure,
      timestamp: point.timestamp,
    }
  }

  updateParams(params: Partial<KalmanFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.state = null
  }
}

/**
 * Create a Kalman filter
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   .addFilter(kalmanFilter({
 *     processNoise: 0.1,
 *     measurementNoise: 0.5
 *   }))
 * ```
 */
export function kalmanFilter(params: KalmanFilterParams): Filter {
  return new KalmanFilterImpl(params)
}

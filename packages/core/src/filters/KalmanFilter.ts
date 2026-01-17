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
  vx: number
  vy: number
  p: number // covariance
  lastTimestamp: number
}

const FILTER_TYPE = 'kalman' as const

/**
 * Kalman filter
 *
 * Combines velocity-based prediction with observation to generate smooth curves.
 * State: [x, y, vx, vy] (position and velocity)
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
        vx: 0,
        vy: 0,
        p: 1,
        lastTimestamp: point.timestamp,
      }
      return point
    }

    const dt = Math.max(
      0.001,
      (point.timestamp - this.state.lastTimestamp) / 1000
    )
    const { processNoise: Q, measurementNoise: R } = this.params

    // Prediction step
    const predictedX = this.state.x + this.state.vx * dt
    const predictedY = this.state.y + this.state.vy * dt
    const predictedP = this.state.p + Q

    // Update step (calculate Kalman gain)
    const K = predictedP / (predictedP + R)

    // Innovation (difference from observation)
    const innovationX = point.x - predictedX
    const innovationY = point.y - predictedY

    // State update
    const newX = predictedX + K * innovationX
    const newY = predictedY + K * innovationY
    // Velocity update: estimate velocity from innovation, with clamping to prevent explosion
    // When direction changes rapidly, innovation/dt can become very large
    const maxVelocity = 5000 // px/s - reasonable max for drawing
    let newVx = this.state.vx + (K * innovationX) / dt
    let newVy = this.state.vy + (K * innovationY) / dt
    // Clamp velocity to prevent runaway values
    newVx = Math.max(-maxVelocity, Math.min(maxVelocity, newVx))
    newVy = Math.max(-maxVelocity, Math.min(maxVelocity, newVy))
    const newP = (1 - K) * predictedP

    this.state = {
      x: newX,
      y: newY,
      vx: newVx,
      vy: newVy,
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

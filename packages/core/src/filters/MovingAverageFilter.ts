import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface MovingAverageFilterParams {
  /** Number of points to average */
  windowSize: number
}

const FILTER_TYPE = 'movingAverage' as const

/**
 * Moving average filter
 *
 * Smooths by averaging the last N points.
 * Simpler and faster than Gaussian filter.
 */
class MovingAverageFilterImpl implements UpdatableFilter<MovingAverageFilterParams> {
  readonly type = FILTER_TYPE
  private params: MovingAverageFilterParams
  private window: PointerPoint[] = []

  constructor(params: MovingAverageFilterParams) {
    this.params = { ...params }
  }

  process(point: PointerPoint): PointerPoint | null {
    this.window.push(point)

    // Remove old points when exceeding window size
    while (this.window.length > this.params.windowSize) {
      this.window.shift()
    }

    // Calculate average
    let sumX = 0
    let sumY = 0
    let sumPressure = 0
    let pressureCount = 0

    for (const p of this.window) {
      sumX += p.x
      sumY += p.y
      if (p.pressure !== undefined) {
        sumPressure += p.pressure
        pressureCount++
      }
    }

    const avgX = sumX / this.window.length
    const avgY = sumY / this.window.length
    const avgPressure =
      pressureCount > 0 ? sumPressure / pressureCount : undefined

    return {
      x: avgX,
      y: avgY,
      pressure: avgPressure,
      timestamp: point.timestamp,
    }
  }

  updateParams(params: Partial<MovingAverageFilterParams>): void {
    this.params = { ...this.params, ...params }
    // Remove old points if window size decreased
    while (this.window.length > this.params.windowSize) {
      this.window.shift()
    }
  }

  reset(): void {
    this.window = []
  }
}

/**
 * Create a moving average filter
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   .addFilter(movingAverageFilter({ windowSize: 5 }))
 * ```
 */
export function movingAverageFilter(params: MovingAverageFilterParams): Filter {
  return new MovingAverageFilterImpl(params)
}

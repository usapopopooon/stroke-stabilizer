import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface EmaFilterParams {
  /**
   * Smoothing coefficient (0-1)
   * - Lower value: stronger smoothing (emphasizes past values)
   * - Higher value: more responsive (emphasizes new values)
   */
  alpha: number
}

const FILTER_TYPE = 'ema' as const

/**
 * Exponential Moving Average (EMA) filter
 *
 * IIR filter. Weights newer values more heavily, older values decay exponentially.
 * Lowest computational cost and minimal latency.
 *
 * Formula: y[n] = α * x[n] + (1 - α) * y[n-1]
 */
class EmaFilterImpl implements UpdatableFilter<EmaFilterParams> {
  readonly type = FILTER_TYPE
  private params: EmaFilterParams
  private lastPoint: PointerPoint | null = null

  constructor(params: EmaFilterParams) {
    this.params = { ...params }
  }

  process(point: PointerPoint): PointerPoint | null {
    if (this.lastPoint === null) {
      this.lastPoint = point
      return point
    }

    const { alpha } = this.params

    // EMA: y = α * x + (1 - α) * y_prev
    const newX = alpha * point.x + (1 - alpha) * this.lastPoint.x
    const newY = alpha * point.y + (1 - alpha) * this.lastPoint.y

    // Apply EMA to pressure if present
    let newPressure: number | undefined
    if (point.pressure !== undefined && this.lastPoint.pressure !== undefined) {
      newPressure =
        alpha * point.pressure + (1 - alpha) * this.lastPoint.pressure
    } else {
      newPressure = point.pressure
    }

    this.lastPoint = {
      x: newX,
      y: newY,
      pressure: newPressure,
      timestamp: point.timestamp,
    }

    return this.lastPoint
  }

  updateParams(params: Partial<EmaFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.lastPoint = null
  }
}

/**
 * Create an Exponential Moving Average (EMA) filter
 *
 * @example
 * ```ts
 * // Strong smoothing
 * const pointer = new StabilizedPointer()
 *   .addFilter(emaFilter({ alpha: 0.2 }))
 *
 * // Light smoothing
 * const pointer = new StabilizedPointer()
 *   .addFilter(emaFilter({ alpha: 0.7 }))
 * ```
 */
export function emaFilter(params: EmaFilterParams): Filter {
  return new EmaFilterImpl(params)
}

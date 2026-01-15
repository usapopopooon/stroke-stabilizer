import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface StringFilterParams {
  /** String length (px): Dead zone radius */
  stringLength: number
}

const FILTER_TYPE = 'string' as const

/**
 * String stabilization filter (Lazy Brush / String Stabilization)
 *
 * Behaves as if there's a virtual "string" between the pen tip and drawing point.
 * Drawing point doesn't move within the string length, but gets pulled when exceeded.
 */
class StringFilterImpl implements UpdatableFilter<StringFilterParams> {
  readonly type = FILTER_TYPE
  private params: StringFilterParams
  private anchorPoint: PointerPoint | null = null

  constructor(params: StringFilterParams) {
    this.params = { ...params }
  }

  process(point: PointerPoint): PointerPoint | null {
    if (this.anchorPoint === null) {
      this.anchorPoint = point
      return point
    }

    const dx = point.x - this.anchorPoint.x
    const dy = point.y - this.anchorPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Within string length, return anchor point (no movement)
    if (distance <= this.params.stringLength) {
      return {
        ...this.anchorPoint,
        pressure: point.pressure,
        timestamp: point.timestamp,
      }
    }

    // Move by the amount exceeding string length
    const ratio = (distance - this.params.stringLength) / distance
    const newX = this.anchorPoint.x + dx * ratio
    const newY = this.anchorPoint.y + dy * ratio

    this.anchorPoint = {
      x: newX,
      y: newY,
      pressure: point.pressure,
      timestamp: point.timestamp,
    }

    return this.anchorPoint
  }

  updateParams(params: Partial<StringFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.anchorPoint = null
  }
}

/**
 * Create a string stabilization filter
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   .addFilter(stringFilter({ stringLength: 10 }))
 * ```
 */
export function stringFilter(params: StringFilterParams): Filter {
  return new StringFilterImpl(params)
}

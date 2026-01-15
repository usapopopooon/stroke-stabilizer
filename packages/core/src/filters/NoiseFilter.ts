import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface NoiseFilterParams {
  /** Minimum movement distance (px). Movements smaller than this are rejected */
  minDistance: number
}

const FILTER_TYPE = 'noise' as const

/**
 * Noise filter
 *
 * Rejects points to eliminate jitter if the distance from the
 * previous point is less than minDistance.
 */
class NoiseFilterImpl implements UpdatableFilter<NoiseFilterParams> {
  readonly type = FILTER_TYPE
  private params: NoiseFilterParams
  private lastPoint: PointerPoint | null = null

  constructor(params: NoiseFilterParams) {
    this.params = { ...params }
  }

  process(point: PointerPoint): PointerPoint | null {
    if (this.lastPoint === null) {
      this.lastPoint = point
      return point
    }

    const dx = point.x - this.lastPoint.x
    const dy = point.y - this.lastPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < this.params.minDistance) {
      return null // Reject
    }

    this.lastPoint = point
    return point
  }

  updateParams(params: Partial<NoiseFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.lastPoint = null
  }
}

/**
 * Create a noise filter
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   .addFilter(noiseFilter({ minDistance: 2 }))
 * ```
 */
export function noiseFilter(params: NoiseFilterParams): Filter {
  return new NoiseFilterImpl(params)
}

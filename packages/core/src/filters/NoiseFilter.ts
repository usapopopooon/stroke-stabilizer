import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface NoiseFilterParams {
  /** 最小移動距離（px）。これ未満の移動は棄却 */
  minDistance: number
}

const FILTER_TYPE = 'noise' as const

/**
 * ノイズフィルタ
 *
 * 前回のポイントからの距離が minDistance 未満の場合、
 * そのポイントを棄却してジッターを除去する。
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
      return null // 棄却
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
 * ノイズフィルタを作成
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

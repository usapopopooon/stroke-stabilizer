import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface EmaFilterParams {
  /**
   * 平滑化係数（0-1）
   * - 小さい値: より強い平滑化（過去を重視）
   * - 大きい値: より敏感（新しい値を重視）
   */
  alpha: number
}

const FILTER_TYPE = 'ema' as const

/**
 * 指数移動平均（EMA）フィルタ
 *
 * IIRフィルタ。新しい値ほど重要視し、古い値は指数関数的に減衰。
 * 計算コストが最も低く、遅延も少ない。
 *
 * 数式: y[n] = α * x[n] + (1 - α) * y[n-1]
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

    // pressure も EMA 適用（存在する場合）
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
 * 指数移動平均（EMA）フィルタを作成
 *
 * @example
 * ```ts
 * // 強い平滑化
 * const pointer = new StabilizedPointer()
 *   .addFilter(emaFilter({ alpha: 0.2 }))
 *
 * // 軽い平滑化
 * const pointer = new StabilizedPointer()
 *   .addFilter(emaFilter({ alpha: 0.7 }))
 * ```
 */
export function emaFilter(params: EmaFilterParams): Filter {
  return new EmaFilterImpl(params)
}

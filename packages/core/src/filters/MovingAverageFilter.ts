import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface MovingAverageFilterParams {
  /** 平均化するポイント数 */
  windowSize: number
}

const FILTER_TYPE = 'movingAverage' as const

/**
 * 移動平均フィルタ
 *
 * 直近 N ポイントの平均を取ることで平滑化を行う。
 * ガウシアンフィルタよりシンプルだが高速。
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

    // ウィンドウサイズを超えたら古いポイントを削除
    while (this.window.length > this.params.windowSize) {
      this.window.shift()
    }

    // 平均を計算
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
    // ウィンドウサイズが小さくなった場合、古いポイントを削除
    while (this.window.length > this.params.windowSize) {
      this.window.shift()
    }
  }

  reset(): void {
    this.window = []
  }
}

/**
 * 移動平均フィルタを作成
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

import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface OneEuroFilterParams {
  /**
   * 最小カットオフ周波数 (Hz)
   * 低速時の平滑化強度。小さいほど滑らか。
   * 推奨: 0.5 - 2.0
   */
  minCutoff: number
  /**
   * 速度係数
   * 速度に応じたカットオフ周波数の増加率。
   * 大きいほど高速時に敏感になる。
   * 推奨: 0.001 - 0.01
   */
  beta: number
  /**
   * 微分カットオフ周波数 (Hz)
   * 速度推定の平滑化。通常は 1.0 で固定。
   */
  dCutoff?: number
}

const FILTER_TYPE = 'oneEuro' as const

/**
 * 低域通過フィルタ（内部用）
 */
class LowPassFilter {
  private y: number | null = null
  private alpha: number = 1

  setAlpha(alpha: number): void {
    this.alpha = Math.max(0, Math.min(1, alpha))
  }

  filter(value: number): number {
    if (this.y === null) {
      this.y = value
    } else {
      this.y = this.alpha * value + (1 - this.alpha) * this.y
    }
    return this.y
  }

  reset(): void {
    this.y = null
  }

  lastValue(): number | null {
    return this.y
  }
}

/**
 * One Euro Filter
 *
 * 速度適応型ローパスフィルタ。
 * - 低速時: 強い平滑化（ジッター除去）
 * - 高速時: 軽い平滑化（遅延を減らす）
 *
 * 論文: https://cristal.univ-lille.fr/~casiez/1euro/
 */
class OneEuroFilterImpl implements UpdatableFilter<OneEuroFilterParams> {
  readonly type = FILTER_TYPE
  private params: OneEuroFilterParams

  private xFilter = new LowPassFilter()
  private yFilter = new LowPassFilter()
  private dxFilter = new LowPassFilter()
  private dyFilter = new LowPassFilter()
  private pressureFilter = new LowPassFilter()

  private lastTimestamp: number | null = null

  constructor(params: OneEuroFilterParams) {
    this.params = {
      dCutoff: 1.0,
      ...params,
    }
  }

  process(point: PointerPoint): PointerPoint | null {
    // サンプリングレートを計算
    let rate = 60 // デフォルト 60Hz
    if (this.lastTimestamp !== null) {
      const dt = (point.timestamp - this.lastTimestamp) / 1000
      if (dt > 0) {
        rate = 1 / dt
      }
    }
    this.lastTimestamp = point.timestamp

    const { minCutoff, beta, dCutoff } = this.params

    // X軸の処理
    const newX = this.filterAxis(
      point.x,
      this.xFilter,
      this.dxFilter,
      rate,
      minCutoff,
      beta,
      dCutoff!
    )

    // Y軸の処理
    const newY = this.filterAxis(
      point.y,
      this.yFilter,
      this.dyFilter,
      rate,
      minCutoff,
      beta,
      dCutoff!
    )

    // Pressureの処理（あれば）
    let newPressure: number | undefined
    if (point.pressure !== undefined) {
      // pressureは速度適応なしの単純EMA
      const alpha = this.computeAlpha(minCutoff, rate)
      this.pressureFilter.setAlpha(alpha)
      newPressure = this.pressureFilter.filter(point.pressure)
    }

    return {
      x: newX,
      y: newY,
      pressure: newPressure,
      timestamp: point.timestamp,
    }
  }

  private filterAxis(
    value: number,
    valueFilter: LowPassFilter,
    derivFilter: LowPassFilter,
    rate: number,
    minCutoff: number,
    beta: number,
    dCutoff: number
  ): number {
    // 前回の値を取得
    const prevValue = valueFilter.lastValue()

    // 微分（速度）を計算
    let dValue = 0
    if (prevValue !== null) {
      dValue = (value - prevValue) * rate
    }

    // 微分をフィルタリング
    const dAlpha = this.computeAlpha(dCutoff, rate)
    derivFilter.setAlpha(dAlpha)
    const filteredDValue = derivFilter.filter(dValue)

    // 速度に応じてカットオフ周波数を調整
    const cutoff = minCutoff + beta * Math.abs(filteredDValue)

    // 値をフィルタリング
    const alpha = this.computeAlpha(cutoff, rate)
    valueFilter.setAlpha(alpha)
    return valueFilter.filter(value)
  }

  private computeAlpha(cutoff: number, rate: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    const te = 1 / rate
    return 1 / (1 + tau / te)
  }

  updateParams(params: Partial<OneEuroFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.xFilter.reset()
    this.yFilter.reset()
    this.dxFilter.reset()
    this.dyFilter.reset()
    this.pressureFilter.reset()
    this.lastTimestamp = null
  }
}

/**
 * One Euro Filter を作成
 *
 * 速度適応型ローパスフィルタ。
 * 低速時は強く平滑化し、高速時は敏感に追従する。
 *
 * @example
 * ```ts
 * // バランスの取れた設定
 * const pointer = new StabilizedPointer()
 *   .addFilter(oneEuroFilter({
 *     minCutoff: 1.0,
 *     beta: 0.007
 *   }))
 *
 * // より滑らか（遅延大）
 * const smooth = oneEuroFilter({ minCutoff: 0.5, beta: 0.001 })
 *
 * // より敏感（ジッター残る可能性）
 * const responsive = oneEuroFilter({ minCutoff: 2.0, beta: 0.01 })
 * ```
 */
export function oneEuroFilter(params: OneEuroFilterParams): Filter {
  return new OneEuroFilterImpl(params)
}

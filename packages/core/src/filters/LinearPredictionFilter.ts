import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface LinearPredictionFilterParams {
  /**
   * 予測に使用するポイント数
   * 多いほど安定するが、計算コストが増加
   * 推奨: 3-5
   */
  historySize: number
  /**
   * 予測の強さ（0-1）
   * - 0: 予測なし（現在位置をそのまま返す）
   * - 1: 完全な予測（速度・加速度を最大限考慮）
   * 推奨: 0.3-0.7
   */
  predictionFactor: number
  /**
   * 平滑化係数（0-1）
   * 予測結果に適用するEMAの係数
   * 推奨: 0.5-0.8
   */
  smoothing?: number
}

const FILTER_TYPE = 'linearPrediction' as const

/**
 * 線形予測フィルタ
 *
 * 過去の位置から速度・加速度を計算し、次の位置を予測することで
 * フィルタリングによる遅延を補償する。
 *
 * 手法:
 * 1. 過去N点から最小二乗法で速度と加速度を推定
 * 2. 予測位置 = 現在位置 + 速度 * Δt + 0.5 * 加速度 * Δt²
 * 3. 予測係数で現在位置と予測位置をブレンド
 */
class LinearPredictionFilterImpl implements UpdatableFilter<LinearPredictionFilterParams> {
  readonly type = FILTER_TYPE
  private params: LinearPredictionFilterParams
  private history: PointerPoint[] = []
  private lastOutput: PointerPoint | null = null

  constructor(params: LinearPredictionFilterParams) {
    this.params = {
      smoothing: 0.6,
      ...params,
    }
  }

  process(point: PointerPoint): PointerPoint | null {
    this.history.push(point)

    // 履歴がhistorySize+1を超えたら古いものを削除
    while (this.history.length > this.params.historySize + 1) {
      this.history.shift()
    }

    // 最初のポイントはそのまま返す
    if (this.history.length === 1) {
      this.lastOutput = point
      return point
    }

    // 速度と加速度を推定
    const { velocity, acceleration } = this.estimateMotion()

    // 時間差を計算（秒単位）
    const dt =
      this.history.length >= 2
        ? (this.history[this.history.length - 1].timestamp -
            this.history[this.history.length - 2].timestamp) /
          1000
        : 1 / 60 // デフォルト60fps

    // 予測位置を計算
    const { predictionFactor } = this.params
    const predictedX =
      point.x +
      velocity.x * dt * predictionFactor +
      0.5 * acceleration.x * dt * dt * predictionFactor
    const predictedY =
      point.y +
      velocity.y * dt * predictionFactor +
      0.5 * acceleration.y * dt * dt * predictionFactor

    // 平滑化を適用
    let outputX = predictedX
    let outputY = predictedY
    let outputPressure = point.pressure

    if (this.lastOutput !== null && this.params.smoothing !== undefined) {
      const s = this.params.smoothing
      outputX = s * predictedX + (1 - s) * this.lastOutput.x
      outputY = s * predictedY + (1 - s) * this.lastOutput.y

      if (
        point.pressure !== undefined &&
        this.lastOutput.pressure !== undefined
      ) {
        outputPressure = s * point.pressure + (1 - s) * this.lastOutput.pressure
      }
    }

    this.lastOutput = {
      x: outputX,
      y: outputY,
      pressure: outputPressure,
      timestamp: point.timestamp,
    }

    return this.lastOutput
  }

  /**
   * 最小二乗法で速度と加速度を推定
   */
  private estimateMotion(): {
    velocity: { x: number; y: number }
    acceleration: { x: number; y: number }
  } {
    const n = this.history.length
    if (n < 2) {
      return {
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      }
    }

    // 時刻を正規化（最初のポイントを0とする）
    const t0 = this.history[0].timestamp
    const times = this.history.map((p) => (p.timestamp - t0) / 1000)
    const xs = this.history.map((p) => p.x)
    const ys = this.history.map((p) => p.y)

    if (n === 2) {
      // 2点の場合は単純な速度計算
      const dt = times[1] - times[0]
      if (dt <= 0) {
        return { velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } }
      }
      return {
        velocity: {
          x: (xs[1] - xs[0]) / dt,
          y: (ys[1] - ys[0]) / dt,
        },
        acceleration: { x: 0, y: 0 },
      }
    }

    // 3点以上の場合は2次多項式フィッティング
    // x(t) = a + b*t + c*t^2
    // velocity = b + 2*c*t
    // acceleration = 2*c

    const fitX = this.polynomialFit(times, xs)
    const fitY = this.polynomialFit(times, ys)

    const lastT = times[times.length - 1]

    return {
      velocity: {
        x: fitX.b + 2 * fitX.c * lastT,
        y: fitY.b + 2 * fitY.c * lastT,
      },
      acceleration: {
        x: 2 * fitX.c,
        y: 2 * fitY.c,
      },
    }
  }

  /**
   * 2次多項式の最小二乗フィッティング
   * y = a + b*x + c*x^2
   */
  private polynomialFit(
    x: number[],
    y: number[]
  ): { a: number; b: number; c: number } {
    const n = x.length

    // 正規方程式の係数行列を構築
    let sumX = 0,
      sumX2 = 0,
      sumX3 = 0,
      sumX4 = 0
    let sumY = 0,
      sumXY = 0,
      sumX2Y = 0

    for (let i = 0; i < n; i++) {
      const xi = x[i]
      const yi = y[i]
      const xi2 = xi * xi
      sumX += xi
      sumX2 += xi2
      sumX3 += xi2 * xi
      sumX4 += xi2 * xi2
      sumY += yi
      sumXY += xi * yi
      sumX2Y += xi2 * yi
    }

    // 連立方程式を解く（クラメルの公式）
    // [n,     sumX,   sumX2 ] [a]   [sumY  ]
    // [sumX,  sumX2,  sumX3 ] [b] = [sumXY ]
    // [sumX2, sumX3,  sumX4 ] [c]   [sumX2Y]

    const det =
      n * (sumX2 * sumX4 - sumX3 * sumX3) -
      sumX * (sumX * sumX4 - sumX3 * sumX2) +
      sumX2 * (sumX * sumX3 - sumX2 * sumX2)

    if (Math.abs(det) < 1e-10) {
      // 行列が特異な場合は線形フィット
      const avgX = sumX / n
      const avgY = sumY / n
      let num = 0,
        den = 0
      for (let i = 0; i < n; i++) {
        num += (x[i] - avgX) * (y[i] - avgY)
        den += (x[i] - avgX) * (x[i] - avgX)
      }
      const b = den > 0 ? num / den : 0
      const a = avgY - b * avgX
      return { a, b, c: 0 }
    }

    const a =
      (sumY * (sumX2 * sumX4 - sumX3 * sumX3) -
        sumX * (sumXY * sumX4 - sumX3 * sumX2Y) +
        sumX2 * (sumXY * sumX3 - sumX2 * sumX2Y)) /
      det

    const b =
      (n * (sumXY * sumX4 - sumX3 * sumX2Y) -
        sumY * (sumX * sumX4 - sumX3 * sumX2) +
        sumX2 * (sumX * sumX2Y - sumXY * sumX2)) /
      det

    const c =
      (n * (sumX2 * sumX2Y - sumXY * sumX3) -
        sumX * (sumX * sumX2Y - sumXY * sumX2) +
        sumY * (sumX * sumX3 - sumX2 * sumX2)) /
      det

    return { a, b, c }
  }

  updateParams(params: Partial<LinearPredictionFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.history = []
    this.lastOutput = null
  }
}

/**
 * 線形予測フィルタを作成
 *
 * 過去の位置から速度・加速度を推定し、次の位置を予測することで
 * フィルタリングによる遅延を補償する。
 *
 * @example
 * ```ts
 * // 標準的な設定
 * const pointer = new StabilizedPointer()
 *   .addFilter(linearPredictionFilter({
 *     historySize: 4,
 *     predictionFactor: 0.5
 *   }))
 *
 * // 強い予測（遅延軽減重視）
 * const responsive = linearPredictionFilter({
 *   historySize: 3,
 *   predictionFactor: 0.8,
 *   smoothing: 0.7
 * })
 *
 * // 安定性重視
 * const stable = linearPredictionFilter({
 *   historySize: 5,
 *   predictionFactor: 0.3,
 *   smoothing: 0.5
 * })
 * ```
 */
export function linearPredictionFilter(
  params: LinearPredictionFilterParams
): Filter {
  return new LinearPredictionFilterImpl(params)
}

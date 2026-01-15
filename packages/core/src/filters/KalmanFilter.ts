import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface KalmanFilterParams {
  /** プロセスノイズ（Q）: 小さいほど予測を信頼 */
  processNoise: number
  /** 観測ノイズ（R）: 大きいほど平滑化が強い */
  measurementNoise: number
}

interface KalmanState {
  x: number
  y: number
  vx: number
  vy: number
  p: number // 共分散
  lastTimestamp: number
}

const FILTER_TYPE = 'kalman' as const

/**
 * カルマンフィルタ
 *
 * 速度ベースの予測と観測を組み合わせて滑らかな曲線を生成。
 * 状態: [x, y, vx, vy]（位置と速度）
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

    // 予測ステップ
    const predictedX = this.state.x + this.state.vx * dt
    const predictedY = this.state.y + this.state.vy * dt
    const predictedP = this.state.p + Q

    // 更新ステップ（カルマンゲイン計算）
    const K = predictedP / (predictedP + R)

    // 観測値との差分
    const innovationX = point.x - predictedX
    const innovationY = point.y - predictedY

    // 状態更新
    const newX = predictedX + K * innovationX
    const newY = predictedY + K * innovationY
    const newVx = this.state.vx + (K * innovationX) / dt
    const newVy = this.state.vy + (K * innovationY) / dt
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
 * カルマンフィルタを作成
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

import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface StringFilterParams {
  /** 紐の長さ（px）: デッドゾーンの半径 */
  stringLength: number
}

const FILTER_TYPE = 'string' as const

/**
 * 紐補正フィルタ（Lazy Brush / String Stabilization）
 *
 * ペン先と描画点の間に仮想的な「紐」があるかのように動作。
 * 紐の長さ以内の移動では描画点は動かず、超えると引っ張られる。
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

    // 紐の長さ以内ならアンカーポイントを返す（動かない）
    if (distance <= this.params.stringLength) {
      return {
        ...this.anchorPoint,
        pressure: point.pressure,
        timestamp: point.timestamp,
      }
    }

    // 紐の長さを超えた分だけ移動
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
 * 紐補正フィルタを作成
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

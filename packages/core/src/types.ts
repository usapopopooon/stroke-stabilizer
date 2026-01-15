/**
 * 2D座標点
 */
export interface Point {
  x: number
  y: number
}

/**
 * タイムスタンプ付きポインター入力点
 */
export interface PointerPoint extends Point {
  pressure?: number
  timestamp: number
}

/**
 * フィルタの基本インターフェース
 */
export interface Filter {
  readonly type: string
  process(point: PointerPoint): PointerPoint | null
  reset(): void
}

/**
 * フィルタのパラメータ更新インターフェース
 */
export interface UpdatableFilter<TParams = unknown> extends Filter {
  updateParams(params: Partial<TParams>): void
}

/**
 * フィルタファクトリ関数の型
 */
export type FilterFactory<TParams = unknown> = (params: TParams) => Filter

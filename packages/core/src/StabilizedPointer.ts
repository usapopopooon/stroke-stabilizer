import type { Filter, Point, PointerPoint, UpdatableFilter } from './types'
import type { Kernel, PaddingMode } from './kernels/types'
import { smooth } from './smooth'

/**
 * 事後処理の設定
 */
interface PostProcessor {
  kernel: Kernel
  padding: PaddingMode
}

/**
 * Dynamic Pipeline Pattern の実装
 *
 * リアルタイムでフィルタの追加・削除・更新が可能なパイプライン。
 * .build() 呼び出しが不要で、常に実行可能な状態を維持する。
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   // リアルタイム層
 *   .addFilter(noiseFilter({ minDistance: 2 }))
 *   .addFilter(kalmanFilter({ processNoise: 0.1 }))
 *   // 事後処理層
 *   .addPostProcess(gaussianKernel({ size: 7 }))
 *
 * // 描画中
 * pointer.process(point)
 *
 * // 完了時
 * const finalStroke = pointer.finish()
 * ```
 */
export class StabilizedPointer {
  private filters: Filter[] = []
  private postProcessors: PostProcessor[] = []
  private buffer: PointerPoint[] = []

  /**
   * フィルタをパイプラインに追加
   * @returns this（メソッドチェーン用）
   */
  addFilter(filter: Filter): this {
    this.filters.push(filter)
    return this
  }

  /**
   * 指定タイプのフィルタを削除
   * @returns 削除成功: true, 見つからない: false
   */
  removeFilter(type: string): boolean {
    const index = this.filters.findIndex((f) => f.type === type)
    if (index === -1) return false
    this.filters.splice(index, 1)
    return true
  }

  /**
   * 指定タイプのフィルタのパラメータを更新
   * @returns 更新成功: true, 見つからない: false
   */
  updateFilter<TParams>(type: string, params: Partial<TParams>): boolean {
    const filter = this.filters.find((f) => f.type === type)
    if (!filter) return false

    if (this.isUpdatableFilter<TParams>(filter)) {
      filter.updateParams(params)
      return true
    }
    return false
  }

  /**
   * 指定タイプのフィルタを取得
   */
  getFilter(type: string): Filter | undefined {
    return this.filters.find((f) => f.type === type)
  }

  /**
   * 現在のフィルタタイプ一覧を取得
   */
  getFilterTypes(): string[] {
    return this.filters.map((f) => f.type)
  }

  /**
   * フィルタが存在するか確認
   */
  hasFilter(type: string): boolean {
    return this.filters.some((f) => f.type === type)
  }

  /**
   * ポイントをパイプラインで処理
   * @returns 処理結果（フィルタで棄却された場合はnull）
   */
  process(point: PointerPoint): PointerPoint | null {
    let current: PointerPoint | null = point

    for (const filter of this.filters) {
      if (current === null) break
      current = filter.process(current)
    }

    if (current !== null) {
      this.buffer.push(current)
    }

    return current
  }

  /**
   * 複数ポイントを一括処理
   * @returns 処理結果の配列（null は除外）
   */
  processAll(points: PointerPoint[]): PointerPoint[] {
    const results: PointerPoint[] = []
    for (const point of points) {
      const result = this.process(point)
      if (result !== null) {
        results.push(result)
      }
    }
    return results
  }

  /**
   * 処理済みバッファを取得
   */
  getBuffer(): readonly PointerPoint[] {
    return this.buffer
  }

  /**
   * 処理済みバッファをクリアして返す
   */
  flushBuffer(): PointerPoint[] {
    const flushed = [...this.buffer]
    this.buffer = []
    return flushed
  }

  /**
   * 全フィルタとバッファをリセット
   */
  reset(): void {
    for (const filter of this.filters) {
      filter.reset()
    }
    this.buffer = []
  }

  /**
   * パイプラインをクリア（全フィルタを削除）
   */
  clear(): void {
    this.filters = []
    this.postProcessors = []
    this.buffer = []
  }

  /**
   * フィルタ数を取得
   */
  get length(): number {
    return this.filters.length
  }

  // ========================================
  // 事後処理層（Post Process）
  // ========================================

  /**
   * 事後処理をパイプラインに追加
   * @returns this（メソッドチェーン用）
   */
  addPostProcess(kernel: Kernel, options: { padding?: PaddingMode } = {}): this {
    this.postProcessors.push({
      kernel,
      padding: options.padding ?? 'reflect',
    })
    return this
  }

  /**
   * 指定タイプの事後処理を削除
   * @returns 削除成功: true, 見つからない: false
   */
  removePostProcess(type: string): boolean {
    const index = this.postProcessors.findIndex((p) => p.kernel.type === type)
    if (index === -1) return false
    this.postProcessors.splice(index, 1)
    return true
  }

  /**
   * 事後処理が存在するか確認
   */
  hasPostProcess(type: string): boolean {
    return this.postProcessors.some((p) => p.kernel.type === type)
  }

  /**
   * 事後処理のタイプ一覧を取得
   */
  getPostProcessTypes(): string[] {
    return this.postProcessors.map((p) => p.kernel.type)
  }

  /**
   * 事後処理数を取得
   */
  get postProcessLength(): number {
    return this.postProcessors.length
  }

  /**
   * ストロークを完了し、事後処理を適用した結果を返す
   * バッファはクリアされ、フィルタはリセットされる
   */
  finish(): Point[] {
    let points: Point[] = [...this.buffer]

    // 事後処理を順に適用
    for (const processor of this.postProcessors) {
      points = smooth(points, {
        kernel: processor.kernel,
        padding: processor.padding,
      })
    }

    // リセット
    this.reset()

    return points
  }

  private isUpdatableFilter<TParams>(
    filter: Filter
  ): filter is UpdatableFilter<TParams> {
    return 'updateParams' in filter && typeof filter.updateParams === 'function'
  }
}

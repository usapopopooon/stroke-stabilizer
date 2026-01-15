import { useCallback, useRef, useMemo } from 'react'
import {
  StabilizedPointer,
  createStabilizedPointer,
  type PointerPoint,
  type Filter,
} from '@stroke-stabilizer/core'

export interface UseStabilizedPointerOptions {
  /** 補正レベル（0-100）。指定時はプリセットが適用される */
  level?: number
  /** カスタムフィルタ。level が指定されていない場合に使用 */
  filters?: Filter[]
  /** ポイント処理時のコールバック */
  onPoint?: (point: PointerPoint) => void
}

export interface UseStabilizedPointerReturn {
  /** ポイントを処理 */
  process: (point: PointerPoint) => PointerPoint | null
  /** 複数ポイントを一括処理 */
  processAll: (points: PointerPoint[]) => PointerPoint[]
  /** バッファをフラッシュ */
  flushBuffer: () => PointerPoint[]
  /** リセット */
  reset: () => void
  /** フィルタを追加 */
  addFilter: (filter: Filter) => void
  /** フィルタを削除 */
  removeFilter: (type: string) => boolean
  /** フィルタのパラメータを更新 */
  updateFilter: <T>(type: string, params: Partial<T>) => boolean
  /** StabilizedPointer インスタンスへの参照 */
  pointer: StabilizedPointer
}

/**
 * 手ぶれ補正のための React Hook
 *
 * @example
 * ```tsx
 * function DrawingCanvas() {
 *   const { process, reset } = useStabilizedPointer({
 *     level: 50,
 *     onPoint: (point) => {
 *       // 補正済みポイントで描画
 *       drawPoint(point)
 *     }
 *   })
 *
 *   const handlePointerMove = (e: React.PointerEvent) => {
 *     process({
 *       x: e.clientX,
 *       y: e.clientY,
 *       pressure: e.pressure,
 *       timestamp: e.timeStamp
 *     })
 *   }
 *
 *   const handlePointerUp = () => {
 *     reset()
 *   }
 *
 *   return <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
 * }
 * ```
 */
export function useStabilizedPointer(
  options: UseStabilizedPointerOptions = {}
): UseStabilizedPointerReturn {
  const { level, filters, onPoint } = options

  const pointerRef = useRef<StabilizedPointer | null>(null)

  // 初期化（lazy initialization）
  const getPointer = useCallback(() => {
    if (!pointerRef.current) {
      if (level !== undefined) {
        pointerRef.current = createStabilizedPointer(level)
      } else {
        pointerRef.current = new StabilizedPointer()
        if (filters) {
          for (const filter of filters) {
            pointerRef.current.addFilter(filter)
          }
        }
      }
    }
    return pointerRef.current
  }, [level, filters])

  const process = useCallback(
    (point: PointerPoint): PointerPoint | null => {
      const result = getPointer().process(point)
      if (result && onPoint) {
        onPoint(result)
      }
      return result
    },
    [getPointer, onPoint]
  )

  const processAll = useCallback(
    (points: PointerPoint[]): PointerPoint[] => {
      const results = getPointer().processAll(points)
      if (onPoint) {
        for (const point of results) {
          onPoint(point)
        }
      }
      return results
    },
    [getPointer, onPoint]
  )

  const flushBuffer = useCallback(() => {
    return getPointer().flushBuffer()
  }, [getPointer])

  const reset = useCallback(() => {
    getPointer().reset()
  }, [getPointer])

  const addFilter = useCallback(
    (filter: Filter) => {
      getPointer().addFilter(filter)
    },
    [getPointer]
  )

  const removeFilter = useCallback(
    (type: string) => {
      return getPointer().removeFilter(type)
    },
    [getPointer]
  )

  const updateFilter = useCallback(
    <T>(type: string, params: Partial<T>) => {
      return getPointer().updateFilter(type, params)
    },
    [getPointer]
  )

  return useMemo(
    () => ({
      process,
      processAll,
      flushBuffer,
      reset,
      addFilter,
      removeFilter,
      updateFilter,
      pointer: getPointer(),
    }),
    [process, processAll, flushBuffer, reset, addFilter, removeFilter, updateFilter, getPointer]
  )
}

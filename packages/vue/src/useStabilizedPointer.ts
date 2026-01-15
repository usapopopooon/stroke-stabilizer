import { ref, shallowRef, computed, onUnmounted } from 'vue'
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

/**
 * 手ぶれ補正のための Vue Composable
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useStabilizedPointer } from '@stroke-stabilizer/vue'
 *
 * const { process, reset } = useStabilizedPointer({
 *   level: 50,
 *   onPoint: (point) => {
 *     // 補正済みポイントで描画
 *     drawPoint(point)
 *   }
 * })
 *
 * function handlePointerMove(e: PointerEvent) {
 *   process({
 *     x: e.clientX,
 *     y: e.clientY,
 *     pressure: e.pressure,
 *     timestamp: e.timeStamp
 *   })
 * }
 *
 * function handlePointerUp() {
 *   reset()
 * }
 * </script>
 *
 * <template>
 *   <canvas @pointermove="handlePointerMove" @pointerup="handlePointerUp" />
 * </template>
 * ```
 */
export function useStabilizedPointer(
  options: UseStabilizedPointerOptions = {}
) {
  const { level, filters, onPoint } = options

  // StabilizedPointer インスタンス（リアクティブにしない）
  const pointer = shallowRef<StabilizedPointer>(
    level !== undefined
      ? createStabilizedPointer(level)
      : (() => {
          const p = new StabilizedPointer()
          if (filters) {
            for (const filter of filters) {
              p.addFilter(filter)
            }
          }
          return p
        })()
  )

  // フィルタ数（リアクティブ）
  const filterCount = ref(pointer.value.length)

  function process(point: PointerPoint): PointerPoint | null {
    const result = pointer.value.process(point)
    if (result && onPoint) {
      onPoint(result)
    }
    return result
  }

  function processAll(points: PointerPoint[]): PointerPoint[] {
    const results = pointer.value.processAll(points)
    if (onPoint) {
      for (const p of results) {
        onPoint(p)
      }
    }
    return results
  }

  function flushBuffer(): PointerPoint[] {
    return pointer.value.flushBuffer()
  }

  function reset(): void {
    pointer.value.reset()
  }

  function addFilter(filter: Filter): void {
    pointer.value.addFilter(filter)
    filterCount.value = pointer.value.length
  }

  function removeFilter(type: string): boolean {
    const result = pointer.value.removeFilter(type)
    filterCount.value = pointer.value.length
    return result
  }

  function updateFilter<T>(type: string, params: Partial<T>): boolean {
    return pointer.value.updateFilter(type, params)
  }

  // クリーンアップ
  onUnmounted(() => {
    pointer.value.clear()
  })

  return {
    process,
    processAll,
    flushBuffer,
    reset,
    addFilter,
    removeFilter,
    updateFilter,
    pointer: computed(() => pointer.value),
    filterCount: computed(() => filterCount.value),
  }
}

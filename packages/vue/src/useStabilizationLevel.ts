import { ref, computed, watch } from 'vue'

export interface UseStabilizationLevelOptions {
  /** 初期値（デフォルト: 0） */
  initialLevel?: number
  /** 最小値（デフォルト: 0） */
  min?: number
  /** 最大値（デフォルト: 100） */
  max?: number
  /** 変更時のコールバック */
  onChange?: (level: number) => void
}

/**
 * 補正レベルを管理するための Vue Composable
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useStabilizationLevel } from '@stroke-stabilizer/vue'
 *
 * const { level, setLevel, isEnabled } = useStabilizationLevel({
 *   initialLevel: 50,
 *   onChange: (newLevel) => console.log('Level changed:', newLevel)
 * })
 * </script>
 *
 * <template>
 *   <div>
 *     <input
 *       type="range"
 *       :min="0"
 *       :max="100"
 *       :value="level"
 *       @input="setLevel(Number(($event.target as HTMLInputElement).value))"
 *     />
 *     <span>{{ level }}%</span>
 *     <span v-if="isEnabled">補正有効</span>
 *   </div>
 * </template>
 * ```
 */
export function useStabilizationLevel(
  options: UseStabilizationLevelOptions = {}
) {
  const { initialLevel = 0, min = 0, max = 100, onChange } = options

  const level = ref(Math.max(min, Math.min(max, initialLevel)))

  // 変更を監視
  watch(level, (newValue) => {
    onChange?.(newValue)
  })

  function setLevel(value: number): void {
    level.value = Math.max(min, Math.min(max, value))
  }

  function increase(amount = 10): void {
    setLevel(level.value + amount)
  }

  function decrease(amount = 10): void {
    setLevel(level.value - amount)
  }

  return {
    level: computed(() => level.value),
    setLevel,
    increase,
    decrease,
    isEnabled: computed(() => level.value > 0),
  }
}

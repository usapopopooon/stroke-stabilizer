import { ref, computed, watch } from 'vue'

export interface UseStabilizationLevelOptions {
  /** Initial value (default: 0) */
  initialLevel?: number
  /** Minimum value (default: 0) */
  min?: number
  /** Maximum value (default: 100) */
  max?: number
  /** Callback when level changes */
  onChange?: (level: number) => void
}

/**
 * Vue Composable for managing stabilization level
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
 *     <span v-if="isEnabled">Stabilization enabled</span>
 *   </div>
 * </template>
 * ```
 */
export function useStabilizationLevel(
  options: UseStabilizationLevelOptions = {}
) {
  const { initialLevel = 0, min = 0, max = 100, onChange } = options

  const level = ref(Math.max(min, Math.min(max, initialLevel)))

  // Watch for changes
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

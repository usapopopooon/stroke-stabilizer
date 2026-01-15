import { useState, useCallback } from 'react'

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

export interface UseStabilizationLevelReturn {
  /** Current stabilization level */
  level: number
  /** Set level */
  setLevel: (level: number) => void
  /** Increase level */
  increase: (amount?: number) => void
  /** Decrease level */
  decrease: (amount?: number) => void
  /** Whether stabilization is enabled */
  isEnabled: boolean
}

/**
 * React Hook for managing stabilization level
 *
 * @example
 * ```tsx
 * function StabilizationControl() {
 *   const { level, setLevel, isEnabled } = useStabilizationLevel({
 *     initialLevel: 50,
 *     onChange: (newLevel) => console.log('Level changed:', newLevel)
 *   })
 *
 *   return (
 *     <div>
 *       <input
 *         type="range"
 *         min={0}
 *         max={100}
 *         value={level}
 *         onChange={(e) => setLevel(Number(e.target.value))}
 *       />
 *       <span>{level}%</span>
 *       {isEnabled && <span>Stabilization enabled</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useStabilizationLevel(
  options: UseStabilizationLevelOptions = {}
): UseStabilizationLevelReturn {
  const { initialLevel = 0, min = 0, max = 100, onChange } = options

  const [level, setLevelState] = useState(() =>
    Math.max(min, Math.min(max, initialLevel))
  )

  const setLevel = useCallback(
    (newLevel: number) => {
      const clamped = Math.max(min, Math.min(max, newLevel))
      setLevelState(clamped)
      onChange?.(clamped)
    },
    [min, max, onChange]
  )

  const increase = useCallback(
    (amount = 10) => {
      setLevel(level + amount)
    },
    [level, setLevel]
  )

  const decrease = useCallback(
    (amount = 10) => {
      setLevel(level - amount)
    },
    [level, setLevel]
  )

  return {
    level,
    setLevel,
    increase,
    decrease,
    isEnabled: level > 0,
  }
}

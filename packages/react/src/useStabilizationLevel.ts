import { useState, useCallback } from 'react'

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

export interface UseStabilizationLevelReturn {
  /** 現在の補正レベル */
  level: number
  /** レベルを設定 */
  setLevel: (level: number) => void
  /** レベルを増加 */
  increase: (amount?: number) => void
  /** レベルを減少 */
  decrease: (amount?: number) => void
  /** 補正が有効かどうか */
  isEnabled: boolean
}

/**
 * 補正レベルを管理するための React Hook
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
 *       {isEnabled && <span>補正有効</span>}
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

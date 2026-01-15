import { StabilizedPointer } from './StabilizedPointer'
import { noiseFilter } from './filters/NoiseFilter'
import { kalmanFilter } from './filters/KalmanFilter'
import { movingAverageFilter } from './filters/MovingAverageFilter'
import { stringFilter } from './filters/StringFilter'

/**
 * レベル（0-100）に応じた StabilizedPointer を作成
 *
 * レベル別のフィルタ構成:
 * - 0%: 補正なし
 * - 1-20%: ノイズフィルタのみ
 * - 21-40%: ノイズ + カルマン
 * - 41-60%: ノイズ + カルマン + 移動平均
 * - 61-80%: 上記 + 紐補正（軽）
 * - 81-100%: 上記 + 紐補正（強）
 *
 * @example
 * ```ts
 * // 中程度の補正
 * const pointer = createStabilizedPointer(50)
 *
 * // 補正なし
 * const raw = createStabilizedPointer(0)
 * ```
 */
export function createStabilizedPointer(level: number): StabilizedPointer {
  const clampedLevel = Math.max(0, Math.min(100, level))
  const pointer = new StabilizedPointer()

  if (clampedLevel === 0) {
    return pointer
  }

  // レベル 1-100: ノイズフィルタ
  const minDistance = 1.0 + (clampedLevel / 100) * 2.0 // 1.0-3.0
  pointer.addFilter(noiseFilter({ minDistance }))

  if (clampedLevel >= 21) {
    // レベル 21-100: カルマンフィルタ
    const processNoise = 0.12 - (clampedLevel / 100) * 0.08 // 0.12-0.04
    const measurementNoise = 0.4 + (clampedLevel / 100) * 0.6 // 0.4-1.0
    pointer.addFilter(kalmanFilter({ processNoise, measurementNoise }))
  }

  if (clampedLevel >= 41) {
    // レベル 41-100: 移動平均フィルタ
    const windowSize = clampedLevel >= 61 ? 7 : 5
    pointer.addFilter(movingAverageFilter({ windowSize }))
  }

  if (clampedLevel >= 61) {
    // レベル 61-100: 紐補正
    const stringLength = clampedLevel >= 81 ? 15 : 8
    pointer.addFilter(stringFilter({ stringLength }))
  }

  return pointer
}

/**
 * プリセット名から StabilizedPointer を作成
 */
export type PresetName = 'none' | 'light' | 'medium' | 'heavy' | 'extreme'

const presetLevels: Record<PresetName, number> = {
  none: 0,
  light: 20,
  medium: 50,
  heavy: 75,
  extreme: 100,
}

/**
 * プリセットから StabilizedPointer を作成
 *
 * @example
 * ```ts
 * const pointer = createFromPreset('medium')
 * ```
 */
export function createFromPreset(preset: PresetName): StabilizedPointer {
  return createStabilizedPointer(presetLevels[preset])
}

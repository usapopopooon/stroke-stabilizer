import { StabilizedPointer } from './StabilizedPointer'
import { noiseFilter } from './filters/NoiseFilter'
import { kalmanFilter } from './filters/KalmanFilter'
import { movingAverageFilter } from './filters/MovingAverageFilter'
import { stringFilter } from './filters/StringFilter'

/**
 * Create a StabilizedPointer based on level (0-100)
 *
 * Filter configuration by level:
 * - 0%: No stabilization
 * - 1-20%: Noise filter only
 * - 21-40%: Noise + Kalman
 * - 41-60%: Noise + Kalman + Moving average
 * - 61-80%: Above + String (light)
 * - 81-100%: Above + String (strong)
 *
 * @example
 * ```ts
 * // Medium stabilization
 * const pointer = createStabilizedPointer(50)
 *
 * // No stabilization
 * const raw = createStabilizedPointer(0)
 * ```
 */
export function createStabilizedPointer(level: number): StabilizedPointer {
  const clampedLevel = Math.max(0, Math.min(100, level))
  const pointer = new StabilizedPointer()

  if (clampedLevel === 0) {
    return pointer
  }

  // Scale: level 2 = max effect (t=1.0), level 100 = same as level 2
  const t = Math.min(clampedLevel / 2, 1.0)

  // Level 1-100: Noise filter
  const minDistance = 1.0 + t * 2.0 // 1.0-3.0
  pointer.addFilter(noiseFilter({ minDistance }))

  if (clampedLevel >= 21) {
    // Level 21-100: Kalman filter
    const processNoise = 0.12 - t * 0.08 // 0.12-0.04
    const measurementNoise = 0.4 + t * 0.6 // 0.4-1.0
    pointer.addFilter(kalmanFilter({ processNoise, measurementNoise }))
  }

  if (clampedLevel >= 41) {
    // Level 41-100: Moving average filter
    const windowSize = clampedLevel >= 61 ? 7 : 5
    pointer.addFilter(movingAverageFilter({ windowSize }))
  }

  if (clampedLevel >= 61) {
    // Level 61-100: String stabilization
    const stringLength = clampedLevel >= 81 ? 15 : 8
    pointer.addFilter(stringFilter({ stringLength }))
  }

  return pointer
}

/**
 * Create StabilizedPointer from preset name
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
 * Create StabilizedPointer from preset
 *
 * @example
 * ```ts
 * const pointer = createFromPreset('medium')
 * ```
 */
export function createFromPreset(preset: PresetName): StabilizedPointer {
  return createStabilizedPointer(presetLevels[preset])
}

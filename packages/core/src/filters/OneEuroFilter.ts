import type { Filter, PointerPoint, UpdatableFilter } from '../types'

export interface OneEuroFilterParams {
  /**
   * Minimum cutoff frequency (Hz)
   * Smoothing strength at low speed. Lower = smoother.
   * Recommended: 0.5 - 2.0
   */
  minCutoff: number
  /**
   * Speed coefficient
   * Rate of cutoff frequency increase based on speed.
   * Higher = more responsive at high speed.
   * Recommended: 0.001 - 0.01
   */
  beta: number
  /**
   * Derivative cutoff frequency (Hz)
   * Smoothing for velocity estimation. Usually fixed at 1.0.
   */
  dCutoff?: number
}

const FILTER_TYPE = 'oneEuro' as const

/**
 * Low-pass filter (internal use)
 */
class LowPassFilter {
  private y: number | null = null
  private alpha: number = 1

  setAlpha(alpha: number): void {
    this.alpha = Math.max(0, Math.min(1, alpha))
  }

  filter(value: number): number {
    if (this.y === null) {
      this.y = value
    } else {
      this.y = this.alpha * value + (1 - this.alpha) * this.y
    }
    return this.y
  }

  reset(): void {
    this.y = null
  }

  lastValue(): number | null {
    return this.y
  }
}

/**
 * One Euro Filter
 *
 * Speed-adaptive low-pass filter.
 * - At low speed: Strong smoothing (jitter removal)
 * - At high speed: Light smoothing (reduce latency)
 *
 * Paper: https://cristal.univ-lille.fr/~casiez/1euro/
 */
class OneEuroFilterImpl implements UpdatableFilter<OneEuroFilterParams> {
  readonly type = FILTER_TYPE
  private params: OneEuroFilterParams

  private xFilter = new LowPassFilter()
  private yFilter = new LowPassFilter()
  private dxFilter = new LowPassFilter()
  private dyFilter = new LowPassFilter()
  private pressureFilter = new LowPassFilter()

  private lastTimestamp: number | null = null

  constructor(params: OneEuroFilterParams) {
    this.params = {
      dCutoff: 1.0,
      ...params,
    }
  }

  process(point: PointerPoint): PointerPoint | null {
    // Calculate sampling rate
    let rate = 60 // Default 60Hz
    if (this.lastTimestamp !== null) {
      const dt = (point.timestamp - this.lastTimestamp) / 1000
      if (dt > 0) {
        rate = 1 / dt
      }
    }
    this.lastTimestamp = point.timestamp

    const { minCutoff, beta, dCutoff } = this.params

    // Process X axis
    const newX = this.filterAxis(
      point.x,
      this.xFilter,
      this.dxFilter,
      rate,
      minCutoff,
      beta,
      dCutoff!
    )

    // Process Y axis
    const newY = this.filterAxis(
      point.y,
      this.yFilter,
      this.dyFilter,
      rate,
      minCutoff,
      beta,
      dCutoff!
    )

    // Process pressure (if present)
    let newPressure: number | undefined
    if (point.pressure !== undefined) {
      // Pressure uses simple EMA without speed adaptation
      const alpha = this.computeAlpha(minCutoff, rate)
      this.pressureFilter.setAlpha(alpha)
      newPressure = this.pressureFilter.filter(point.pressure)
    }

    return {
      x: newX,
      y: newY,
      pressure: newPressure,
      timestamp: point.timestamp,
    }
  }

  private filterAxis(
    value: number,
    valueFilter: LowPassFilter,
    derivFilter: LowPassFilter,
    rate: number,
    minCutoff: number,
    beta: number,
    dCutoff: number
  ): number {
    // Get previous value
    const prevValue = valueFilter.lastValue()

    // Calculate derivative (velocity)
    let dValue = 0
    if (prevValue !== null) {
      dValue = (value - prevValue) * rate
    }

    // Filter the derivative
    const dAlpha = this.computeAlpha(dCutoff, rate)
    derivFilter.setAlpha(dAlpha)
    const filteredDValue = derivFilter.filter(dValue)

    // Adjust cutoff frequency based on speed
    const cutoff = minCutoff + beta * Math.abs(filteredDValue)

    // Filter the value
    const alpha = this.computeAlpha(cutoff, rate)
    valueFilter.setAlpha(alpha)
    return valueFilter.filter(value)
  }

  private computeAlpha(cutoff: number, rate: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    const te = 1 / rate
    return 1 / (1 + tau / te)
  }

  updateParams(params: Partial<OneEuroFilterParams>): void {
    this.params = { ...this.params, ...params }
  }

  reset(): void {
    this.xFilter.reset()
    this.yFilter.reset()
    this.dxFilter.reset()
    this.dyFilter.reset()
    this.pressureFilter.reset()
    this.lastTimestamp = null
  }
}

/**
 * Create a One Euro Filter
 *
 * Speed-adaptive low-pass filter.
 * Strong smoothing at low speed, responsive at high speed.
 *
 * @example
 * ```ts
 * // Balanced settings
 * const pointer = new StabilizedPointer()
 *   .addFilter(oneEuroFilter({
 *     minCutoff: 1.0,
 *     beta: 0.007
 *   }))
 *
 * // Smoother (higher latency)
 * const smooth = oneEuroFilter({ minCutoff: 0.5, beta: 0.001 })
 *
 * // More responsive (may have jitter)
 * const responsive = oneEuroFilter({ minCutoff: 2.0, beta: 0.01 })
 * ```
 */
export function oneEuroFilter(params: OneEuroFilterParams): Filter {
  return new OneEuroFilterImpl(params)
}

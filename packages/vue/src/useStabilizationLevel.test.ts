import { describe, it, expect, vi } from 'vitest'
import { useStabilizationLevel } from './useStabilizationLevel'

describe('useStabilizationLevel', () => {
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { level, isEnabled } = useStabilizationLevel()

      expect(level.value).toBe(0)
      expect(isEnabled.value).toBe(false)
    })

    it('should initialize with custom initial level', () => {
      const { level, isEnabled } = useStabilizationLevel({ initialLevel: 50 })

      expect(level.value).toBe(50)
      expect(isEnabled.value).toBe(true)
    })

    it('should clamp initial level to min', () => {
      const { level } = useStabilizationLevel({ initialLevel: -10, min: 0 })

      expect(level.value).toBe(0)
    })

    it('should clamp initial level to max', () => {
      const { level } = useStabilizationLevel({ initialLevel: 150, max: 100 })

      expect(level.value).toBe(100)
    })

    it('should respect custom min and max', () => {
      const { level } = useStabilizationLevel({
        initialLevel: 50,
        min: 20,
        max: 80,
      })

      expect(level.value).toBe(50)
    })
  })

  describe('setLevel', () => {
    it('should set level directly', () => {
      const { level, setLevel } = useStabilizationLevel()

      setLevel(75)

      expect(level.value).toBe(75)
    })

    it('should clamp level to min', () => {
      const { level, setLevel } = useStabilizationLevel({ min: 10, max: 90 })

      setLevel(5)

      expect(level.value).toBe(10)
    })

    it('should clamp level to max', () => {
      const { level, setLevel } = useStabilizationLevel({ min: 10, max: 90 })

      setLevel(100)

      expect(level.value).toBe(90)
    })

    it('should call onChange callback', async () => {
      const onChange = vi.fn()
      const { setLevel } = useStabilizationLevel({ onChange })

      setLevel(50)

      // Vue watch is async
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(50)
    })

    it('should call onChange with clamped value', async () => {
      const onChange = vi.fn()
      const { setLevel } = useStabilizationLevel({ max: 80, onChange })

      setLevel(100)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onChange).toHaveBeenCalledWith(80)
    })
  })

  describe('increase', () => {
    it('should increase level by default amount (10)', () => {
      const { level, increase } = useStabilizationLevel({ initialLevel: 50 })

      increase()

      expect(level.value).toBe(60)
    })

    it('should increase level by custom amount', () => {
      const { level, increase } = useStabilizationLevel({ initialLevel: 50 })

      increase(25)

      expect(level.value).toBe(75)
    })

    it('should clamp to max when increasing', () => {
      const { level, increase } = useStabilizationLevel({
        initialLevel: 95,
        max: 100,
      })

      increase(10)

      expect(level.value).toBe(100)
    })

    it('should call onChange when increasing', async () => {
      const onChange = vi.fn()
      const { increase } = useStabilizationLevel({
        initialLevel: 50,
        onChange,
      })

      increase(10)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onChange).toHaveBeenCalledWith(60)
    })
  })

  describe('decrease', () => {
    it('should decrease level by default amount (10)', () => {
      const { level, decrease } = useStabilizationLevel({ initialLevel: 50 })

      decrease()

      expect(level.value).toBe(40)
    })

    it('should decrease level by custom amount', () => {
      const { level, decrease } = useStabilizationLevel({ initialLevel: 50 })

      decrease(25)

      expect(level.value).toBe(25)
    })

    it('should clamp to min when decreasing', () => {
      const { level, decrease } = useStabilizationLevel({
        initialLevel: 5,
        min: 0,
      })

      decrease(10)

      expect(level.value).toBe(0)
    })

    it('should call onChange when decreasing', async () => {
      const onChange = vi.fn()
      const { decrease } = useStabilizationLevel({
        initialLevel: 50,
        onChange,
      })

      decrease(10)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onChange).toHaveBeenCalledWith(40)
    })
  })

  describe('isEnabled', () => {
    it('should be false when level is 0', () => {
      const { isEnabled } = useStabilizationLevel({ initialLevel: 0 })

      expect(isEnabled.value).toBe(false)
    })

    it('should be true when level is greater than 0', () => {
      const { isEnabled } = useStabilizationLevel({ initialLevel: 1 })

      expect(isEnabled.value).toBe(true)
    })

    it('should update when level changes', () => {
      const { isEnabled, setLevel } = useStabilizationLevel({
        initialLevel: 50,
      })

      expect(isEnabled.value).toBe(true)

      setLevel(0)

      expect(isEnabled.value).toBe(false)

      setLevel(10)

      expect(isEnabled.value).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle min equal to max', () => {
      const { level, increase, decrease } = useStabilizationLevel({
        initialLevel: 50,
        min: 50,
        max: 50,
      })

      expect(level.value).toBe(50)

      increase(10)
      expect(level.value).toBe(50)

      decrease(10)
      expect(level.value).toBe(50)
    })

    it('should handle negative initial level with positive min', () => {
      const { level } = useStabilizationLevel({
        initialLevel: -50,
        min: 10,
      })

      expect(level.value).toBe(10)
    })

    it('should handle multiple sequential operations', () => {
      const { level, increase, decrease } = useStabilizationLevel({
        initialLevel: 50,
      })

      increase(10)
      expect(level.value).toBe(60)

      increase(10)
      expect(level.value).toBe(70)

      decrease(5)
      expect(level.value).toBe(65)
    })
  })
})

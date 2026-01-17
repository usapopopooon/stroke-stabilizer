/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStabilizationLevel } from './useStabilizationLevel'

describe('useStabilizationLevel', () => {
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useStabilizationLevel())

      expect(result.current.level).toBe(0)
      expect(result.current.isEnabled).toBe(false)
    })

    it('should initialize with custom initial level', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      expect(result.current.level).toBe(50)
      expect(result.current.isEnabled).toBe(true)
    })

    it('should clamp initial level to min', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: -10, min: 0 })
      )

      expect(result.current.level).toBe(0)
    })

    it('should clamp initial level to max', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 150, max: 100 })
      )

      expect(result.current.level).toBe(100)
    })

    it('should respect custom min and max', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50, min: 20, max: 80 })
      )

      expect(result.current.level).toBe(50)
    })
  })

  describe('setLevel', () => {
    it('should set level directly', () => {
      const { result } = renderHook(() => useStabilizationLevel())

      act(() => {
        result.current.setLevel(75)
      })

      expect(result.current.level).toBe(75)
    })

    it('should clamp level to min', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ min: 10, max: 90 })
      )

      act(() => {
        result.current.setLevel(5)
      })

      expect(result.current.level).toBe(10)
    })

    it('should clamp level to max', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ min: 10, max: 90 })
      )

      act(() => {
        result.current.setLevel(100)
      })

      expect(result.current.level).toBe(90)
    })

    it('should call onChange callback', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useStabilizationLevel({ onChange }))

      act(() => {
        result.current.setLevel(50)
      })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(50)
    })

    it('should call onChange with clamped value', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() =>
        useStabilizationLevel({ max: 80, onChange })
      )

      act(() => {
        result.current.setLevel(100)
      })

      expect(onChange).toHaveBeenCalledWith(80)
    })
  })

  describe('increase', () => {
    it('should increase level by default amount (10)', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      act(() => {
        result.current.increase()
      })

      expect(result.current.level).toBe(60)
    })

    it('should increase level by custom amount', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      act(() => {
        result.current.increase(25)
      })

      expect(result.current.level).toBe(75)
    })

    it('should clamp to max when increasing', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 95, max: 100 })
      )

      act(() => {
        result.current.increase(10)
      })

      expect(result.current.level).toBe(100)
    })

    it('should call onChange when increasing', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50, onChange })
      )

      act(() => {
        result.current.increase(10)
      })

      expect(onChange).toHaveBeenCalledWith(60)
    })
  })

  describe('decrease', () => {
    it('should decrease level by default amount (10)', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      act(() => {
        result.current.decrease()
      })

      expect(result.current.level).toBe(40)
    })

    it('should decrease level by custom amount', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      act(() => {
        result.current.decrease(25)
      })

      expect(result.current.level).toBe(25)
    })

    it('should clamp to min when decreasing', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 5, min: 0 })
      )

      act(() => {
        result.current.decrease(10)
      })

      expect(result.current.level).toBe(0)
    })

    it('should call onChange when decreasing', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50, onChange })
      )

      act(() => {
        result.current.decrease(10)
      })

      expect(onChange).toHaveBeenCalledWith(40)
    })
  })

  describe('isEnabled', () => {
    it('should be false when level is 0', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 0 })
      )

      expect(result.current.isEnabled).toBe(false)
    })

    it('should be true when level is greater than 0', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 1 })
      )

      expect(result.current.isEnabled).toBe(true)
    })

    it('should update when level changes', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      expect(result.current.isEnabled).toBe(true)

      act(() => {
        result.current.setLevel(0)
      })

      expect(result.current.isEnabled).toBe(false)

      act(() => {
        result.current.setLevel(10)
      })

      expect(result.current.isEnabled).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle min equal to max', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50, min: 50, max: 50 })
      )

      expect(result.current.level).toBe(50)

      act(() => {
        result.current.increase(10)
      })

      expect(result.current.level).toBe(50)

      act(() => {
        result.current.decrease(10)
      })

      expect(result.current.level).toBe(50)
    })

    it('should handle negative initial level with positive min', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: -50, min: 10 })
      )

      expect(result.current.level).toBe(10)
    })

    it('should handle multiple sequential operations', () => {
      const { result } = renderHook(() =>
        useStabilizationLevel({ initialLevel: 50 })
      )

      act(() => {
        result.current.increase(10)
      })
      expect(result.current.level).toBe(60)

      act(() => {
        result.current.increase(10)
      })
      expect(result.current.level).toBe(70)

      act(() => {
        result.current.decrease(5)
      })
      expect(result.current.level).toBe(65)
    })
  })
})

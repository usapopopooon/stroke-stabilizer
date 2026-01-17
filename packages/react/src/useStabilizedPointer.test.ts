/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStabilizedPointer } from './useStabilizedPointer'
import { noiseFilter, type PointerPoint } from '@stroke-stabilizer/core'

function createPoint(
  x: number,
  y: number,
  timestamp = Date.now()
): PointerPoint {
  return { x, y, timestamp }
}

describe('useStabilizedPointer', () => {
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      expect(result.current.pointer).toBeDefined()
      expect(typeof result.current.process).toBe('function')
      expect(typeof result.current.processAll).toBe('function')
      expect(typeof result.current.flushBuffer).toBe('function')
      expect(typeof result.current.reset).toBe('function')
      expect(typeof result.current.addFilter).toBe('function')
      expect(typeof result.current.removeFilter).toBe('function')
      expect(typeof result.current.updateFilter).toBe('function')
    })

    it('should initialize with level option', () => {
      const { result } = renderHook(() => useStabilizedPointer({ level: 50 }))

      // Level 50 should create noise + kalman + movingAverage filters
      expect(result.current.pointer.length).toBe(3)
    })

    it('should initialize with level 0', () => {
      const { result } = renderHook(() => useStabilizedPointer({ level: 0 }))

      expect(result.current.pointer.length).toBe(0)
    })

    it('should initialize with level 100', () => {
      const { result } = renderHook(() => useStabilizedPointer({ level: 100 }))

      // Level 100 should create noise + kalman + movingAverage + string filters
      expect(result.current.pointer.length).toBe(4)
    })

    it('should initialize with custom filters', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { result } = renderHook(() =>
        useStabilizedPointer({ filters: [filter] })
      )

      expect(result.current.pointer.length).toBe(1)
    })

    it('should prioritize level over custom filters', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { result } = renderHook(() =>
        useStabilizedPointer({ level: 20, filters: [filter] })
      )

      // Level 20 creates only noise filter, ignoring custom filters
      expect(result.current.pointer.length).toBe(1)
    })
  })

  describe('process', () => {
    it('should process a point', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      const point = createPoint(10, 20)
      let processed: PointerPoint | null = null

      act(() => {
        processed = result.current.process(point)
      })

      expect(processed).not.toBeNull()
      expect(processed?.x).toBe(10)
      expect(processed?.y).toBe(20)
    })

    it('should call onPoint callback when point is processed', () => {
      const onPoint = vi.fn()
      const { result } = renderHook(() => useStabilizedPointer({ onPoint }))

      const point = createPoint(10, 20)

      act(() => {
        result.current.process(point)
      })

      expect(onPoint).toHaveBeenCalledTimes(1)
      expect(onPoint).toHaveBeenCalledWith(
        expect.objectContaining({ x: 10, y: 20 })
      )
    })

    it('should not call onPoint when point is rejected', () => {
      const onPoint = vi.fn()
      const filter = noiseFilter({ minDistance: 100 })
      const { result } = renderHook(() =>
        useStabilizedPointer({ filters: [filter], onPoint })
      )

      act(() => {
        result.current.process(createPoint(0, 0))
      })

      expect(onPoint).toHaveBeenCalledTimes(1)
      onPoint.mockClear()

      act(() => {
        result.current.process(createPoint(1, 1)) // Rejected
      })

      expect(onPoint).not.toHaveBeenCalled()
    })
  })

  describe('processAll', () => {
    it('should process multiple points', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
      ]

      let results: PointerPoint[] = []

      act(() => {
        results = result.current.processAll(points)
      })

      expect(results.length).toBe(3)
    })

    it('should call onPoint for each processed point', () => {
      const onPoint = vi.fn()
      const { result } = renderHook(() => useStabilizedPointer({ onPoint }))

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
      ]

      act(() => {
        result.current.processAll(points)
      })

      expect(onPoint).toHaveBeenCalledTimes(3)
    })
  })

  describe('flushBuffer', () => {
    it('should flush and return buffer contents', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      act(() => {
        result.current.process(createPoint(10, 10))
        result.current.process(createPoint(20, 20))
      })

      let flushed: PointerPoint[] = []

      act(() => {
        flushed = result.current.flushBuffer()
      })

      expect(flushed.length).toBe(2)
      expect(result.current.pointer.getBuffer().length).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset the pointer state', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { result } = renderHook(() =>
        useStabilizedPointer({ filters: [filter] })
      )

      act(() => {
        result.current.process(createPoint(0, 0))
        result.current.process(createPoint(100, 100))
      })

      expect(result.current.pointer.getBuffer().length).toBe(2)

      act(() => {
        result.current.reset()
      })

      expect(result.current.pointer.getBuffer().length).toBe(0)
      // Filter still exists
      expect(result.current.pointer.length).toBe(1)
    })
  })

  describe('filter management', () => {
    it('should add a filter', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      expect(result.current.pointer.length).toBe(0)

      act(() => {
        result.current.addFilter(noiseFilter({ minDistance: 5 }))
      })

      expect(result.current.pointer.length).toBe(1)
    })

    it('should remove a filter', () => {
      const { result } = renderHook(() =>
        useStabilizedPointer({ filters: [noiseFilter({ minDistance: 5 })] })
      )

      expect(result.current.pointer.length).toBe(1)

      let removed = false

      act(() => {
        removed = result.current.removeFilter('noise')
      })

      expect(removed).toBe(true)
      expect(result.current.pointer.length).toBe(0)
    })

    it('should return false when removing non-existent filter', () => {
      const { result } = renderHook(() => useStabilizedPointer())

      let removed = false

      act(() => {
        removed = result.current.removeFilter('nonexistent')
      })

      expect(removed).toBe(false)
    })

    it('should update filter parameters', () => {
      const { result } = renderHook(() =>
        useStabilizedPointer({ filters: [noiseFilter({ minDistance: 5 })] })
      )

      let updated = false

      act(() => {
        updated = result.current.updateFilter('noise', { minDistance: 10 })
      })

      expect(updated).toBe(true)
    })
  })

  describe('pointer reference stability', () => {
    it('should return consistent pointer reference', () => {
      const { result, rerender } = renderHook(() => useStabilizedPointer())

      const pointer1 = result.current.pointer
      rerender()
      const pointer2 = result.current.pointer

      expect(pointer1).toBe(pointer2)
    })
  })
})

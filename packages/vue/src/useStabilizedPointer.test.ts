import { describe, it, expect, vi } from 'vitest'
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
      const {
        pointer,
        filterCount,
        process,
        processAll,
        flushBuffer,
        reset,
        addFilter,
        removeFilter,
        updateFilter,
      } = useStabilizedPointer()

      expect(pointer.value).toBeDefined()
      expect(filterCount.value).toBe(0)
      expect(typeof process).toBe('function')
      expect(typeof processAll).toBe('function')
      expect(typeof flushBuffer).toBe('function')
      expect(typeof reset).toBe('function')
      expect(typeof addFilter).toBe('function')
      expect(typeof removeFilter).toBe('function')
      expect(typeof updateFilter).toBe('function')
    })

    it('should initialize with level option', () => {
      const { filterCount } = useStabilizedPointer({ level: 50 })

      // Level 50 should create noise + kalman + movingAverage filters
      expect(filterCount.value).toBe(3)
    })

    it('should initialize with level 0', () => {
      const { filterCount } = useStabilizedPointer({ level: 0 })

      expect(filterCount.value).toBe(0)
    })

    it('should initialize with level 100', () => {
      const { filterCount } = useStabilizedPointer({ level: 100 })

      // Level 100 should create noise + kalman + movingAverage + string filters
      expect(filterCount.value).toBe(4)
    })

    it('should initialize with custom filters', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { filterCount } = useStabilizedPointer({ filters: [filter] })

      expect(filterCount.value).toBe(1)
    })

    it('should prioritize level over custom filters', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { filterCount } = useStabilizedPointer({
        level: 20,
        filters: [filter],
      })

      // Level 20 creates only noise filter, ignoring custom filters
      expect(filterCount.value).toBe(1)
    })
  })

  describe('process', () => {
    it('should process a point', () => {
      const { process } = useStabilizedPointer()

      const point = createPoint(10, 20)
      const processed = process(point)

      expect(processed).not.toBeNull()
      expect(processed?.x).toBe(10)
      expect(processed?.y).toBe(20)
    })

    it('should call onPoint callback when point is processed', () => {
      const onPoint = vi.fn()
      const { process } = useStabilizedPointer({ onPoint })

      const point = createPoint(10, 20)
      process(point)

      expect(onPoint).toHaveBeenCalledTimes(1)
      expect(onPoint).toHaveBeenCalledWith(
        expect.objectContaining({ x: 10, y: 20 })
      )
    })

    it('should not call onPoint when point is rejected', () => {
      const onPoint = vi.fn()
      const filter = noiseFilter({ minDistance: 100 })
      const { process } = useStabilizedPointer({ filters: [filter], onPoint })

      process(createPoint(0, 0))
      expect(onPoint).toHaveBeenCalledTimes(1)
      onPoint.mockClear()

      process(createPoint(1, 1)) // Rejected
      expect(onPoint).not.toHaveBeenCalled()
    })
  })

  describe('processAll', () => {
    it('should process multiple points', () => {
      const { processAll } = useStabilizedPointer()

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
      ]

      const results = processAll(points)

      expect(results.length).toBe(3)
    })

    it('should call onPoint for each processed point', () => {
      const onPoint = vi.fn()
      const { processAll } = useStabilizedPointer({ onPoint })

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
      ]

      processAll(points)

      expect(onPoint).toHaveBeenCalledTimes(3)
    })
  })

  describe('flushBuffer', () => {
    it('should flush and return buffer contents', () => {
      const { process, flushBuffer, pointer } = useStabilizedPointer()

      process(createPoint(10, 10))
      process(createPoint(20, 20))

      const flushed = flushBuffer()

      expect(flushed.length).toBe(2)
      expect(pointer.value.getBuffer().length).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset the pointer state', () => {
      const filter = noiseFilter({ minDistance: 5 })
      const { process, reset, pointer, filterCount } = useStabilizedPointer({
        filters: [filter],
      })

      process(createPoint(0, 0))
      process(createPoint(100, 100))

      expect(pointer.value.getBuffer().length).toBe(2)

      reset()

      expect(pointer.value.getBuffer().length).toBe(0)
      // Filter still exists
      expect(filterCount.value).toBe(1)
    })
  })

  describe('filter management', () => {
    it('should add a filter', () => {
      const { addFilter, filterCount } = useStabilizedPointer()

      expect(filterCount.value).toBe(0)

      addFilter(noiseFilter({ minDistance: 5 }))

      expect(filterCount.value).toBe(1)
    })

    it('should remove a filter', () => {
      const { removeFilter, filterCount } = useStabilizedPointer({
        filters: [noiseFilter({ minDistance: 5 })],
      })

      expect(filterCount.value).toBe(1)

      const removed = removeFilter('noise')

      expect(removed).toBe(true)
      expect(filterCount.value).toBe(0)
    })

    it('should return false when removing non-existent filter', () => {
      const { removeFilter } = useStabilizedPointer()

      const removed = removeFilter('nonexistent')

      expect(removed).toBe(false)
    })

    it('should update filter parameters', () => {
      const { updateFilter } = useStabilizedPointer({
        filters: [noiseFilter({ minDistance: 5 })],
      })

      const updated = updateFilter('noise', { minDistance: 10 })

      expect(updated).toBe(true)
    })
  })

  describe('pointer reference stability', () => {
    it('should provide consistent pointer through computed', () => {
      const { pointer } = useStabilizedPointer()

      const pointer1 = pointer.value
      const pointer2 = pointer.value

      expect(pointer1).toBe(pointer2)
    })
  })

  describe('filterCount reactivity', () => {
    it('should update filterCount when filters change', () => {
      const { addFilter, removeFilter, filterCount } = useStabilizedPointer()

      expect(filterCount.value).toBe(0)

      addFilter(noiseFilter({ minDistance: 5 }))
      expect(filterCount.value).toBe(1)

      addFilter(noiseFilter({ minDistance: 10 }))
      expect(filterCount.value).toBe(2)

      removeFilter('noise')
      expect(filterCount.value).toBe(1)
    })
  })
})

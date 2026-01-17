import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { StabilizedPointer } from './StabilizedPointer'
import { noiseFilter } from './filters/NoiseFilter'
import { kalmanFilter } from './filters/KalmanFilter'
import { movingAverageFilter } from './filters/MovingAverageFilter'
import { stringFilter } from './filters/StringFilter'
import { gaussianKernel } from './kernels/gaussianKernel'
import { boxKernel } from './kernels/boxKernel'
import type { PointerPoint } from './types'

function createPoint(
  x: number,
  y: number,
  timestamp = Date.now()
): PointerPoint {
  return { x, y, timestamp }
}

describe('StabilizedPointer', () => {
  let pointer: StabilizedPointer

  beforeEach(() => {
    pointer = new StabilizedPointer()
  })

  describe('Dynamic Pipeline Pattern', () => {
    it('should start with no filters', () => {
      expect(pointer.length).toBe(0)
      expect(pointer.getFilterTypes()).toEqual([])
    })

    it('should add filters with method chaining', () => {
      const result = pointer
        .addFilter(noiseFilter({ minDistance: 2 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))

      expect(result).toBe(pointer)
      expect(pointer.length).toBe(2)
      expect(pointer.getFilterTypes()).toEqual(['noise', 'kalman'])
    })

    it('should remove filters by type', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 2 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))

      expect(pointer.removeFilter('noise')).toBe(true)
      expect(pointer.length).toBe(1)
      expect(pointer.getFilterTypes()).toEqual(['kalman'])
    })

    it('should return false when removing non-existent filter', () => {
      expect(pointer.removeFilter('nonexistent')).toBe(false)
    })

    it('should update filter parameters', () => {
      pointer.addFilter(noiseFilter({ minDistance: 2 }))

      expect(pointer.updateFilter('noise', { minDistance: 5 })).toBe(true)
    })

    it('should return false when updating non-existent filter', () => {
      expect(pointer.updateFilter('nonexistent', {})).toBe(false)
    })

    it('should check filter existence', () => {
      pointer.addFilter(noiseFilter({ minDistance: 2 }))

      expect(pointer.hasFilter('noise')).toBe(true)
      expect(pointer.hasFilter('kalman')).toBe(false)
    })

    it('should get filter by type', () => {
      const filter = noiseFilter({ minDistance: 2 })
      pointer.addFilter(filter)

      expect(pointer.getFilter('noise')).toBe(filter)
      expect(pointer.getFilter('nonexistent')).toBeUndefined()
    })
  })

  describe('process', () => {
    it('should pass through points without filters', () => {
      const point = createPoint(10, 20)
      const result = pointer.process(point)

      expect(result).toEqual(point)
    })

    it('should apply filters in order', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 0 })) // Pass through
        .addFilter(movingAverageFilter({ windowSize: 1 })) // Pass through

      const point = createPoint(10, 20)
      const result = pointer.process(point)

      expect(result).not.toBeNull()
      expect(result?.x).toBeCloseTo(10)
      expect(result?.y).toBeCloseTo(20)
    })

    it('should return null when filter rejects point', () => {
      pointer.addFilter(noiseFilter({ minDistance: 100 }))

      const point1 = createPoint(0, 0)
      const point2 = createPoint(1, 1) // Rejected (distance < 100)

      expect(pointer.process(point1)).not.toBeNull()
      expect(pointer.process(point2)).toBeNull()
    })

    it('should add processed points to buffer', () => {
      const point = createPoint(10, 20)
      pointer.process(point)

      const buffer = pointer.getBuffer()
      expect(buffer.length).toBe(1)
      expect(buffer[0]).toEqual(point)
    })

    it('should not add rejected points to buffer', () => {
      pointer.addFilter(noiseFilter({ minDistance: 100 }))

      pointer.process(createPoint(0, 0))
      pointer.process(createPoint(1, 1)) // Rejected

      expect(pointer.getBuffer().length).toBe(1)
    })
  })

  describe('processAll', () => {
    it('should process multiple points', () => {
      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
      ]

      const results = pointer.processAll(points)

      expect(results.length).toBe(3)
    })

    it('should filter out rejected points', () => {
      pointer.addFilter(noiseFilter({ minDistance: 15 }))

      const points = [
        createPoint(0, 0, 0),
        createPoint(5, 5, 100), // Rejected (distance ~7)
        createPoint(20, 20, 200), // Passed (distance ~28)
      ]

      const results = pointer.processAll(points)

      expect(results.length).toBe(2)
    })
  })

  describe('buffer management', () => {
    it('should flush buffer and return contents', () => {
      pointer.process(createPoint(10, 10))
      pointer.process(createPoint(20, 20))

      const flushed = pointer.flushBuffer()

      expect(flushed.length).toBe(2)
      expect(pointer.getBuffer().length).toBe(0)
    })

    it('should reset filters and clear buffer', () => {
      pointer.addFilter(noiseFilter({ minDistance: 2 }))
      pointer.process(createPoint(0, 0))
      pointer.process(createPoint(100, 100))

      pointer.reset()

      expect(pointer.getBuffer().length).toBe(0)
      // Filters still exist
      expect(pointer.length).toBe(1)
    })

    it('should clear all filters and buffer', () => {
      pointer.addFilter(noiseFilter({ minDistance: 2 }))
      pointer.process(createPoint(10, 10))

      pointer.clear()

      expect(pointer.length).toBe(0)
      expect(pointer.getBuffer().length).toBe(0)
    })
  })

  describe('filter integration', () => {
    it('should work with noise + kalman pipeline', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 1 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
        createPoint(30, 30, 300),
      ]

      const results = pointer.processAll(points)

      // Smoothed by Kalman filter, not perfectly straight but close
      expect(results.length).toBeGreaterThan(0)
    })

    it('should work with string filter for lazy brush effect', () => {
      pointer.addFilter(stringFilter({ stringLength: 10 }))

      // First point
      const p1 = pointer.process(createPoint(0, 0, 0))
      expect(p1?.x).toBe(0)
      expect(p1?.y).toBe(0)

      // Movement within string length -> anchor doesn't move
      const p2 = pointer.process(createPoint(5, 5, 100))
      expect(p2?.x).toBe(0)
      expect(p2?.y).toBe(0)

      // Movement exceeding string length -> pulled
      const p3 = pointer.process(createPoint(20, 20, 200))
      expect(p3?.x).toBeGreaterThan(0)
      expect(p3?.y).toBeGreaterThan(0)
    })
  })

  // ========================================
  // Post Process
  // ========================================

  describe('post process', () => {
    it('should start with no post processors', () => {
      expect(pointer.postProcessLength).toBe(0)
      expect(pointer.getPostProcessTypes()).toEqual([])
    })

    it('should add post processors with method chaining', () => {
      const result = pointer
        .addFilter(noiseFilter({ minDistance: 2 }))
        .addPostProcess(gaussianKernel({ size: 5 }))
        .addPostProcess(boxKernel({ size: 3 }))

      expect(result).toBe(pointer)
      expect(pointer.length).toBe(1) // Filter count
      expect(pointer.postProcessLength).toBe(2) // Post process count
      expect(pointer.getPostProcessTypes()).toEqual(['gaussian', 'box'])
    })

    it('should remove post processors by type', () => {
      pointer
        .addPostProcess(gaussianKernel({ size: 5 }))
        .addPostProcess(boxKernel({ size: 3 }))

      expect(pointer.removePostProcess('gaussian')).toBe(true)
      expect(pointer.postProcessLength).toBe(1)
      expect(pointer.getPostProcessTypes()).toEqual(['box'])
    })

    it('should return false when removing non-existent post processor', () => {
      expect(pointer.removePostProcess('nonexistent')).toBe(false)
    })

    it('should check post processor existence', () => {
      pointer.addPostProcess(gaussianKernel({ size: 5 }))

      expect(pointer.hasPostProcess('gaussian')).toBe(true)
      expect(pointer.hasPostProcess('box')).toBe(false)
    })

    it('should clear post processors with clear()', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 2 }))
        .addPostProcess(gaussianKernel({ size: 5 }))

      pointer.clear()

      expect(pointer.length).toBe(0)
      expect(pointer.postProcessLength).toBe(0)
    })
  })

  describe('finishWithoutReset', () => {
    it('should return buffer when no post processors', () => {
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 10, 100))
      pointer.process(createPoint(20, 20, 200))

      const result = pointer.finishWithoutReset()

      expect(result.length).toBe(3)
      expect(result[0].x).toBe(0)
      expect(result[1].x).toBe(10)
      expect(result[2].x).toBe(20)
    })

    it('should apply post processors', () => {
      pointer.addPostProcess(boxKernel({ size: 3 }))

      // Zigzag pattern
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 20, 100))
      pointer.process(createPoint(20, 0, 200))

      const result = pointer.finishWithoutReset()

      expect(result.length).toBe(3)
      // Should be smoothed
      expect(result[1].y).toBeGreaterThan(0)
      expect(result[1].y).toBeLessThan(20)
    })

    it('should preserve buffer after finishWithoutReset', () => {
      pointer.process(createPoint(10, 10, 0))
      pointer.process(createPoint(20, 20, 100))

      pointer.finishWithoutReset()

      // Buffer should still exist
      expect(pointer.getBuffer().length).toBe(2)
    })

    it('should allow re-applying with different post processors', () => {
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 100, 100)) // Spike
      pointer.process(createPoint(20, 0, 200))

      // First application with box kernel
      pointer.addPostProcess(boxKernel({ size: 3 }))
      const result1 = pointer.finishWithoutReset()
      const y1 = result1[1].y

      // Change to gaussian kernel and re-apply
      pointer.removePostProcess('box')
      pointer.addPostProcess(gaussianKernel({ size: 3 }))
      const result2 = pointer.finishWithoutReset()
      const y2 = result2[1].y

      // Both should be smoothed but may differ slightly
      expect(y1).toBeLessThan(100)
      expect(y2).toBeLessThan(100)
      // Buffer still intact
      expect(pointer.getBuffer().length).toBe(3)
    })

    it('should flush pending batch before applying', () => {
      pointer.enableBatching()
      pointer.queue(createPoint(0, 0, 0))
      pointer.queue(createPoint(10, 10, 100))

      const result = pointer.finishWithoutReset()

      expect(result.length).toBe(2)
      expect(pointer.pendingCount).toBe(0)
    })
  })

  describe('finish', () => {
    it('should return buffer when no post processors', () => {
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 10, 100))
      pointer.process(createPoint(20, 20, 200))

      const result = pointer.finish()

      expect(result.length).toBe(3)
      expect(result[0].x).toBe(0)
      expect(result[0].y).toBe(0)
      expect(result[1].x).toBe(10)
      expect(result[1].y).toBe(10)
      expect(result[2].x).toBe(20)
      expect(result[2].y).toBe(20)
    })

    it('should apply post processors on finish', () => {
      pointer.addPostProcess(boxKernel({ size: 3 }))

      // Zigzag pattern
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 20, 100))
      pointer.process(createPoint(20, 0, 200))
      pointer.process(createPoint(30, 20, 300))
      pointer.process(createPoint(40, 0, 400))

      const result = pointer.finish()

      expect(result.length).toBe(5)
      // Should be smoothed
      expect(result[2].y).toBeGreaterThan(0)
      expect(result[2].y).toBeLessThan(20)
    })

    it('should apply multiple post processors in order', () => {
      pointer
        .addPostProcess(boxKernel({ size: 3 }))
        .addPostProcess(gaussianKernel({ size: 3 }))

      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 100, 100)) // Spike
      pointer.process(createPoint(20, 0, 200))

      const result = pointer.finish()

      expect(result.length).toBe(3)
      // Smoothed twice, should be quite flat
      expect(result[1].y).toBeLessThan(100)
    })

    it('should reset buffer after finish', () => {
      pointer.process(createPoint(10, 10, 0))
      pointer.finish()

      expect(pointer.getBuffer().length).toBe(0)
    })

    it('should reset filters after finish', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(100, 100, 100))
      pointer.finish()

      // Filter is reset, so first point should pass
      const result = pointer.process(createPoint(1, 1, 200))
      expect(result).not.toBeNull()
    })

    it('should work with realtime filters + post process', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 1 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))
        .addPostProcess(gaussianKernel({ size: 5 }))

      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
        createPoint(30, 30, 300),
        createPoint(40, 40, 400),
      ]

      for (const p of points) {
        pointer.process(p)
      }

      const result = pointer.finish()

      // Both realtime filters and post processing applied
      expect(result.length).toBeGreaterThan(0)
    })
  })

  // ========================================
  // Batch Processing (rAF)
  // ========================================

  describe('batch processing', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('enableBatching / disableBatching', () => {
      it('should start with batching disabled', () => {
        expect(pointer.isBatchingEnabled).toBe(false)
      })

      it('should enable batching with method chaining', () => {
        const result = pointer.enableBatching()

        expect(result).toBe(pointer)
        expect(pointer.isBatchingEnabled).toBe(true)
      })

      it('should disable batching with method chaining', () => {
        pointer.enableBatching()
        const result = pointer.disableBatching()

        expect(result).toBe(pointer)
        expect(pointer.isBatchingEnabled).toBe(false)
      })

      it('should chain with other methods', () => {
        const result = pointer
          .addFilter(noiseFilter({ minDistance: 2 }))
          .enableBatching({ onBatch: () => {} })
          .addPostProcess(gaussianKernel({ size: 5 }))

        expect(result).toBe(pointer)
        expect(pointer.length).toBe(1)
        expect(pointer.isBatchingEnabled).toBe(true)
        expect(pointer.postProcessLength).toBe(1)
      })
    })

    describe('queue', () => {
      it('should process immediately when batching disabled', () => {
        const point = createPoint(10, 20)
        pointer.queue(point)

        expect(pointer.getBuffer().length).toBe(1)
        expect(pointer.pendingCount).toBe(0)
      })

      it('should queue points when batching enabled', () => {
        pointer.enableBatching()
        pointer.queue(createPoint(10, 20))

        expect(pointer.pendingCount).toBe(1)
        expect(pointer.getBuffer().length).toBe(0)
      })

      it('should support method chaining', () => {
        pointer.enableBatching()
        const result = pointer
          .queue(createPoint(10, 20))
          .queue(createPoint(30, 40))

        expect(result).toBe(pointer)
        expect(pointer.pendingCount).toBe(2)
      })

      it('should process pending points on next frame', () => {
        pointer.enableBatching()
        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))

        expect(pointer.getBuffer().length).toBe(0)

        vi.runAllTimers()

        expect(pointer.getBuffer().length).toBe(2)
        expect(pointer.pendingCount).toBe(0)
      })
    })

    describe('queueAll', () => {
      it('should process immediately when batching disabled', () => {
        const points = [createPoint(10, 20), createPoint(30, 40)]
        pointer.queueAll(points)

        expect(pointer.getBuffer().length).toBe(2)
        expect(pointer.pendingCount).toBe(0)
      })

      it('should queue all points when batching enabled', () => {
        pointer.enableBatching()
        const points = [createPoint(10, 20), createPoint(30, 40)]
        pointer.queueAll(points)

        expect(pointer.pendingCount).toBe(2)
        expect(pointer.getBuffer().length).toBe(0)
      })

      it('should support method chaining', () => {
        pointer.enableBatching()
        const result = pointer.queueAll([createPoint(10, 20)])

        expect(result).toBe(pointer)
      })
    })

    describe('flushBatch', () => {
      it('should force process pending points', () => {
        pointer.enableBatching()
        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))

        const results = pointer.flushBatch()

        expect(results.length).toBe(2)
        expect(pointer.pendingCount).toBe(0)
        expect(pointer.getBuffer().length).toBe(2)
      })

      it('should return empty array when no pending points', () => {
        pointer.enableBatching()
        const results = pointer.flushBatch()

        expect(results).toEqual([])
      })

      it('should cancel scheduled flush', () => {
        const onBatch = vi.fn()
        pointer.enableBatching({ onBatch })
        pointer.queue(createPoint(10, 20))

        pointer.flushBatch()
        vi.runAllTimers()

        // onBatch should be called only once (from flushBatch, not from rAF)
        expect(onBatch).toHaveBeenCalledTimes(1)
      })
    })

    describe('callbacks', () => {
      it('should call onPoint for each processed point', () => {
        const onPoint = vi.fn()
        pointer.enableBatching({ onPoint })

        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))
        vi.runAllTimers()

        expect(onPoint).toHaveBeenCalledTimes(2)
        expect(onPoint).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ x: 10, y: 20 })
        )
        expect(onPoint).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ x: 30, y: 40 })
        )
      })

      it('should call onBatch with all processed points', () => {
        const onBatch = vi.fn()
        pointer.enableBatching({ onBatch })

        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))
        vi.runAllTimers()

        expect(onBatch).toHaveBeenCalledTimes(1)
        expect(onBatch).toHaveBeenCalledWith([
          expect.objectContaining({ x: 10, y: 20 }),
          expect.objectContaining({ x: 30, y: 40 }),
        ])
      })

      it('should not call callbacks for rejected points', () => {
        const onPoint = vi.fn()
        const onBatch = vi.fn()
        pointer
          .addFilter(noiseFilter({ minDistance: 100 }))
          .enableBatching({ onPoint, onBatch })

        pointer.queue(createPoint(0, 0))
        pointer.queue(createPoint(1, 1)) // Rejected
        vi.runAllTimers()

        expect(onPoint).toHaveBeenCalledTimes(1)
        expect(onBatch).toHaveBeenCalledWith([
          expect.objectContaining({ x: 0, y: 0 }),
        ])
      })

      it('should not call onBatch when all points are rejected', () => {
        const onBatch = vi.fn()
        pointer
          .addFilter(noiseFilter({ minDistance: 100 }))
          .enableBatching({ onBatch })

        pointer.queue(createPoint(0, 0))
        vi.runAllTimers()
        onBatch.mockClear()

        pointer.queue(createPoint(1, 1)) // Rejected
        vi.runAllTimers()

        expect(onBatch).not.toHaveBeenCalled()
      })
    })

    describe('disableBatching behavior', () => {
      it('should flush pending points when disabling', () => {
        const onBatch = vi.fn()
        pointer.enableBatching({ onBatch })

        pointer.queue(createPoint(10, 20))
        pointer.disableBatching()

        expect(pointer.getBuffer().length).toBe(1)
        expect(pointer.pendingCount).toBe(0)
      })
    })

    describe('finish with batching', () => {
      it('should flush pending points before finishing', () => {
        pointer.enableBatching()
        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))

        const result = pointer.finish()

        expect(result.length).toBe(2)
      })

      it('should apply post processors after flushing batch', () => {
        pointer.addPostProcess(boxKernel({ size: 3 })).enableBatching()

        pointer.queue(createPoint(0, 0, 0))
        pointer.queue(createPoint(10, 100, 100)) // Spike
        pointer.queue(createPoint(20, 0, 200))

        const result = pointer.finish()

        expect(result.length).toBe(3)
        // Smoothed
        expect(result[1].y).toBeLessThan(100)
      })
    })

    describe('batch coalescing', () => {
      it('should coalesce multiple queues into single batch', () => {
        const onBatch = vi.fn()
        pointer.enableBatching({ onBatch })

        // Queue multiple times before frame
        pointer.queue(createPoint(10, 20))
        pointer.queue(createPoint(30, 40))
        pointer.queue(createPoint(50, 60))

        vi.runAllTimers()

        // Should be called once with all points
        expect(onBatch).toHaveBeenCalledTimes(1)
        expect(onBatch).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ x: 10 }),
            expect.objectContaining({ x: 30 }),
            expect.objectContaining({ x: 50 }),
          ])
        )
      })

      it('should process in separate batches across frames', () => {
        const onBatch = vi.fn()
        pointer.enableBatching({ onBatch })

        pointer.queue(createPoint(10, 20))
        vi.runAllTimers()

        pointer.queue(createPoint(30, 40))
        vi.runAllTimers()

        expect(onBatch).toHaveBeenCalledTimes(2)
      })
    })
  })
})

// ============================================
// Edge Case Tests
// ============================================

describe('StabilizedPointer - Edge Cases', () => {
  let pointer: StabilizedPointer

  beforeEach(() => {
    pointer = new StabilizedPointer()
  })

  describe('filter management edge cases', () => {
    it('should handle adding duplicate filter types', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.addFilter(noiseFilter({ minDistance: 10 }))

      expect(pointer.length).toBe(2)
      expect(pointer.getFilterTypes()).toEqual(['noise', 'noise'])
    })

    it('should only remove first matching filter', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.addFilter(noiseFilter({ minDistance: 10 }))

      pointer.removeFilter('noise')

      expect(pointer.length).toBe(1)
    })

    it('should handle complex filter chains (5+ filters)', () => {
      pointer
        .addFilter(noiseFilter({ minDistance: 1 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))
        .addFilter(movingAverageFilter({ windowSize: 3 }))
        .addFilter(stringFilter({ stringLength: 10 }))
        .addFilter(noiseFilter({ minDistance: 0.5 }))

      expect(pointer.length).toBe(5)

      // Process points through complex chain
      const points = [
        createPoint(0, 0, 0),
        createPoint(10, 10, 100),
        createPoint(20, 20, 200),
        createPoint(30, 30, 300),
        createPoint(40, 40, 400),
      ]

      const results = pointer.processAll(points)
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => isFinite(r.x) && isFinite(r.y))).toBe(true)
    })

    it('should handle clearing and re-adding filters', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.clear()

      expect(pointer.length).toBe(0)

      pointer.addFilter(
        kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
      )
      expect(pointer.length).toBe(1)
      expect(pointer.getFilterTypes()).toEqual(['kalman'])
    })
  })

  describe('processing edge cases', () => {
    it('should handle processing immediately after clear()', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.process(createPoint(0, 0, 0))
      pointer.clear()

      // Process without any filters
      const result = pointer.process(createPoint(10, 10, 100))
      expect(result).not.toBeNull()
      expect(result?.x).toBe(10)
    })

    it('should handle processing immediately after reset()', () => {
      pointer.addFilter(noiseFilter({ minDistance: 5 }))
      pointer.process(createPoint(0, 0, 0))
      pointer.reset()

      // Filter still exists but state is reset
      const result = pointer.process(createPoint(1, 1, 100))
      expect(result).not.toBeNull() // First point after reset passes
    })

    it('should handle finish() called multiple times without new processing', () => {
      pointer.process(createPoint(10, 10, 0))
      pointer.process(createPoint(20, 20, 100))

      const result1 = pointer.finish()
      expect(result1.length).toBe(2)

      // Second finish with empty buffer
      const result2 = pointer.finish()
      expect(result2.length).toBe(0)
    })

    it('should handle finish() with no data', () => {
      const result = pointer.finish()
      expect(result).toEqual([])
    })

    it('should handle very rapid consecutive processes', () => {
      pointer.addFilter(
        kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 })
      )

      const results: PointerPoint[] = []
      for (let i = 0; i < 100; i++) {
        const result = pointer.process(createPoint(i, i, i))
        if (result) results.push(result)
      }

      expect(results.length).toBe(100)
      expect(results.every((r) => isFinite(r.x) && isFinite(r.y))).toBe(true)
    })

    it('should handle points with zero coordinates', () => {
      const result = pointer.process(createPoint(0, 0, 0))
      expect(result).not.toBeNull()
      expect(result?.x).toBe(0)
      expect(result?.y).toBe(0)
    })

    it('should handle points with negative coordinates', () => {
      const result = pointer.process(createPoint(-100, -200, 0))
      expect(result).not.toBeNull()
      expect(result?.x).toBe(-100)
      expect(result?.y).toBe(-200)
    })

    it('should handle points with very large coordinates', () => {
      const result = pointer.process(createPoint(1000000, 2000000, 0))
      expect(result).not.toBeNull()
      expect(isFinite(result?.x ?? 0)).toBe(true)
      expect(isFinite(result?.y ?? 0)).toBe(true)
    })

    it('should handle points with pressure 0', () => {
      const result = pointer.process({
        x: 10,
        y: 20,
        pressure: 0,
        timestamp: 0,
      })
      expect(result).not.toBeNull()
      expect(result?.pressure).toBe(0)
    })

    it('should handle points with pressure 1', () => {
      const result = pointer.process({
        x: 10,
        y: 20,
        pressure: 1,
        timestamp: 0,
      })
      expect(result).not.toBeNull()
      expect(result?.pressure).toBe(1)
    })
  })

  describe('post process edge cases', () => {
    it('should handle post process with no data', () => {
      pointer.addPostProcess(gaussianKernel({ size: 5 }))
      const result = pointer.finish()
      expect(result).toEqual([])
    })

    it('should handle multiple post processors', () => {
      pointer
        .addPostProcess(boxKernel({ size: 3 }))
        .addPostProcess(gaussianKernel({ size: 3 }))
        .addPostProcess(boxKernel({ size: 3 }))

      expect(pointer.postProcessLength).toBe(3)

      // Process some points
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 100, 100))
      pointer.process(createPoint(20, 0, 200))

      const result = pointer.finish()
      expect(result.length).toBe(3)
      // Multiple smoothing passes should smooth the spike significantly
      expect(result[1].y).toBeLessThan(100)
    })

    it('should handle removing all post processors', () => {
      pointer.addPostProcess(boxKernel({ size: 3 }))
      pointer.addPostProcess(gaussianKernel({ size: 3 }))

      pointer.removePostProcess('box')
      pointer.removePostProcess('gaussian')

      expect(pointer.postProcessLength).toBe(0)
    })

    it('should handle post process with single point', () => {
      pointer.addPostProcess(gaussianKernel({ size: 5 }))
      pointer.process(createPoint(10, 20, 0))

      const result = pointer.finish()
      expect(result.length).toBe(1)
    })

    it('should handle post process with two points', () => {
      pointer.addPostProcess(boxKernel({ size: 3 }))
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 10, 100))

      const result = pointer.finish()
      expect(result.length).toBe(2)
    })
  })

  describe('batch processing edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should handle rapid enable/disable batching cycles', () => {
      pointer.enableBatching()
      pointer.queue(createPoint(10, 20))
      pointer.disableBatching()
      expect(pointer.getBuffer().length).toBe(1)

      pointer.enableBatching()
      pointer.queue(createPoint(30, 40))
      pointer.disableBatching()
      expect(pointer.getBuffer().length).toBe(2)
    })

    it('should handle queue when batching is disabled then enabled', () => {
      pointer.queue(createPoint(10, 20)) // Direct process
      expect(pointer.getBuffer().length).toBe(1)

      pointer.enableBatching()
      pointer.queue(createPoint(30, 40)) // Queued
      expect(pointer.pendingCount).toBe(1)
      expect(pointer.getBuffer().length).toBe(1)

      vi.runAllTimers()
      expect(pointer.getBuffer().length).toBe(2)
    })

    it('should handle flushBatch when empty', () => {
      pointer.enableBatching()
      const results = pointer.flushBatch()
      expect(results).toEqual([])
    })

    it('should handle batching with filters that reject all points', () => {
      const onBatch = vi.fn()
      pointer
        .addFilter(noiseFilter({ minDistance: 1000 }))
        .enableBatching({ onBatch })

      pointer.queue(createPoint(0, 0))
      vi.runAllTimers()
      onBatch.mockClear()

      // All subsequent points will be rejected
      pointer.queue(createPoint(1, 1))
      pointer.queue(createPoint(2, 2))
      vi.runAllTimers()

      // onBatch should not be called when all points are rejected
      expect(onBatch).not.toHaveBeenCalled()
    })

    it('should handle finish with pending batch and post processors', () => {
      pointer.addPostProcess(boxKernel({ size: 3 })).enableBatching()

      pointer.queue(createPoint(0, 0, 0))
      pointer.queue(createPoint(10, 100, 100))
      pointer.queue(createPoint(20, 0, 200))

      const result = pointer.finish()

      expect(result.length).toBe(3)
      expect(result[1].y).toBeLessThan(100) // Smoothed
    })
  })

  describe('buffer management edge cases', () => {
    it('should handle flushBuffer on empty buffer', () => {
      const result = pointer.flushBuffer()
      expect(result).toEqual([])
    })

    it('should handle getBuffer returning consistent reference', () => {
      pointer.process(createPoint(10, 10, 0))
      const buffer1 = pointer.getBuffer()
      const buffer2 = pointer.getBuffer()

      expect(buffer1).toEqual(buffer2)
      expect(buffer1.length).toBe(1)
      expect(buffer2.length).toBe(1)
    })
  })

  describe('method chaining completeness', () => {
    it('should support full method chain', () => {
      const result = pointer
        .addFilter(noiseFilter({ minDistance: 2 }))
        .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.5 }))
        .addPostProcess(gaussianKernel({ size: 5 }))
        .enableBatching()
        .queue(createPoint(0, 0, 0))
        .queue(createPoint(10, 10, 100))
        .flushBatch()

      expect(Array.isArray(result)).toBe(true)
    })
  })
})

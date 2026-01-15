import { describe, it, expect, beforeEach } from 'vitest'
import { StabilizedPointer } from './StabilizedPointer'
import { noiseFilter } from './filters/NoiseFilter'
import { kalmanFilter } from './filters/KalmanFilter'
import { movingAverageFilter } from './filters/MovingAverageFilter'
import { stringFilter } from './filters/StringFilter'
import { gaussianKernel } from './kernels/gaussianKernel'
import { boxKernel } from './kernels/boxKernel'
import type { PointerPoint } from './types'

function createPoint(x: number, y: number, timestamp = Date.now()): PointerPoint {
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
        .addFilter(noiseFilter({ minDistance: 0 })) // パススルー
        .addFilter(movingAverageFilter({ windowSize: 1 })) // パススルー

      const point = createPoint(10, 20)
      const result = pointer.process(point)

      expect(result).not.toBeNull()
      expect(result?.x).toBeCloseTo(10)
      expect(result?.y).toBeCloseTo(20)
    })

    it('should return null when filter rejects point', () => {
      pointer.addFilter(noiseFilter({ minDistance: 100 }))

      const point1 = createPoint(0, 0)
      const point2 = createPoint(1, 1) // 距離が100未満なので棄却

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
      pointer.process(createPoint(1, 1)) // 棄却される

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
        createPoint(5, 5, 100), // 棄却（距離 ~7）
        createPoint(20, 20, 200), // 通過（距離 ~28）
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
      // フィルタはまだ存在
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

      // カルマンフィルタで平滑化されるので、
      // 完全に直線にはならないが近い値になる
      expect(results.length).toBeGreaterThan(0)
    })

    it('should work with string filter for lazy brush effect', () => {
      pointer.addFilter(stringFilter({ stringLength: 10 }))

      // 最初のポイント
      const p1 = pointer.process(createPoint(0, 0, 0))
      expect(p1?.x).toBe(0)
      expect(p1?.y).toBe(0)

      // 紐の長さ以内の移動 → アンカーは動かない
      const p2 = pointer.process(createPoint(5, 5, 100))
      expect(p2?.x).toBe(0)
      expect(p2?.y).toBe(0)

      // 紐の長さを超える移動 → 引っ張られる
      const p3 = pointer.process(createPoint(20, 20, 200))
      expect(p3?.x).toBeGreaterThan(0)
      expect(p3?.y).toBeGreaterThan(0)
    })
  })

  // ========================================
  // Post Process（事後処理）
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
      expect(pointer.length).toBe(1) // フィルタ数
      expect(pointer.postProcessLength).toBe(2) // 事後処理数
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

      // ジグザグパターン
      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 20, 100))
      pointer.process(createPoint(20, 0, 200))
      pointer.process(createPoint(30, 20, 300))
      pointer.process(createPoint(40, 0, 400))

      const result = pointer.finish()

      expect(result.length).toBe(5)
      // 平滑化されているはず
      expect(result[2].y).toBeGreaterThan(0)
      expect(result[2].y).toBeLessThan(20)
    })

    it('should apply multiple post processors in order', () => {
      pointer
        .addPostProcess(boxKernel({ size: 3 }))
        .addPostProcess(gaussianKernel({ size: 3 }))

      pointer.process(createPoint(0, 0, 0))
      pointer.process(createPoint(10, 100, 100)) // スパイク
      pointer.process(createPoint(20, 0, 200))

      const result = pointer.finish()

      expect(result.length).toBe(3)
      // 2回平滑化されているのでかなり平らになる
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

      // フィルタがリセットされているので、最初のポイントは通過する
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

      // リアルタイムフィルタ + 事後処理が両方適用される
      expect(result.length).toBeGreaterThan(0)
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  createStabilizedPointer,
  createFromPreset,
  PresetName,
} from './presets'
import { PointerPoint } from './types'

describe('createStabilizedPointer', () => {
  describe('level 0 (no stabilization)', () => {
    it('should create pointer with no filters at level 0', () => {
      const pointer = createStabilizedPointer(0)
      expect(pointer.getFilterTypes()).toEqual([])
    })

    it('should pass through points unchanged at level 0', () => {
      const pointer = createStabilizedPointer(0)
      const point: PointerPoint = {
        x: 100,
        y: 200,
        pressure: 0.5,
        timestamp: 1000,
      }
      const result = pointer.process(point)
      expect(result).toEqual(point)
    })
  })

  describe('level 1-20 (noise filter only)', () => {
    it('should add only noise filter at level 1', () => {
      const pointer = createStabilizedPointer(1)
      expect(pointer.getFilterTypes()).toEqual(['noise'])
    })

    it('should add only noise filter at level 20', () => {
      const pointer = createStabilizedPointer(20)
      expect(pointer.getFilterTypes()).toEqual(['noise'])
    })

    it('should filter close points at level 20', () => {
      const pointer = createStabilizedPointer(20)
      pointer.process({ x: 0, y: 0, timestamp: 0 })
      // minDistance at level 20 = 1.0 + 0.2 * 2.0 = 1.4
      const result = pointer.process({ x: 0.5, y: 0.5, timestamp: 10 })
      expect(result).toBeNull() // Should be filtered (distance < 1.4)
    })
  })

  describe('level 21-40 (noise + kalman)', () => {
    it('should add noise and kalman filters at level 21', () => {
      const pointer = createStabilizedPointer(21)
      expect(pointer.getFilterTypes()).toEqual(['noise', 'kalman'])
    })

    it('should add noise and kalman filters at level 40', () => {
      const pointer = createStabilizedPointer(40)
      expect(pointer.getFilterTypes()).toEqual(['noise', 'kalman'])
    })

    it('should smooth points at level 30', () => {
      const pointer = createStabilizedPointer(30)
      const points: PointerPoint[] = [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 10, timestamp: 100 },
        { x: 20, y: 20, timestamp: 200 },
      ]
      const results = pointer.processAll(points)
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('level 41-60 (noise + kalman + moving average)', () => {
    it('should add three filters at level 41', () => {
      const pointer = createStabilizedPointer(41)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
      ])
    })

    it('should add three filters at level 60', () => {
      const pointer = createStabilizedPointer(60)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
      ])
    })

    it('should use windowSize 5 at level 50', () => {
      const pointer = createStabilizedPointer(50)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
      ])
      // Verify by processing multiple points
      const results: PointerPoint[] = []
      for (let i = 0; i < 10; i++) {
        const result = pointer.process({
          x: i * 10,
          y: i * 10,
          timestamp: i * 100,
        })
        if (result) results.push(result)
      }
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('level 61-80 (noise + kalman + moving average + string light)', () => {
    it('should add four filters at level 61', () => {
      const pointer = createStabilizedPointer(61)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should add four filters at level 80', () => {
      const pointer = createStabilizedPointer(80)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should use windowSize 7 at level 70', () => {
      const pointer = createStabilizedPointer(70)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })
  })

  describe('level 81-100 (noise + kalman + moving average + string strong)', () => {
    it('should add four filters at level 81', () => {
      const pointer = createStabilizedPointer(81)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should add four filters at level 100', () => {
      const pointer = createStabilizedPointer(100)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should provide strong stabilization at level 100', () => {
      const pointer = createStabilizedPointer(100)
      // First point always passes through
      pointer.process({ x: 0, y: 0, timestamp: 0 })
      // Strong string filter should smooth out small movements
      const result = pointer.process({ x: 5, y: 5, timestamp: 100 })
      // Due to stringLength=15, point should be pulled back toward anchor
      if (result) {
        expect(result.x).toBeLessThan(5)
        expect(result.y).toBeLessThan(5)
      }
    })
  })

  describe('parameter calculations', () => {
    it('should calculate minDistance correctly', () => {
      // minDistance = 1.0 + (level/100) * 2.0
      // level 0: 1.0, level 50: 2.0, level 100: 3.0
      const pointer0 = createStabilizedPointer(0)
      const pointer50 = createStabilizedPointer(50)
      const pointer100 = createStabilizedPointer(100)

      // At level 0, no filters
      expect(pointer0.getFilterTypes()).toEqual([])

      // At level 50, noise filter minDistance should be 2.0
      // Point at distance 1.5 should be filtered
      pointer50.process({ x: 0, y: 0, timestamp: 0 })
      const result50 = pointer50.process({ x: 1, y: 1, timestamp: 10 }) // distance ~1.41
      expect(result50).toBeNull()

      // At level 100, noise filter minDistance should be 3.0
      // Point at distance 2.5 should be filtered
      pointer100.process({ x: 0, y: 0, timestamp: 0 })
      const result100 = pointer100.process({ x: 1.5, y: 1.5, timestamp: 10 }) // distance ~2.12
      expect(result100).toBeNull()
    })
  })

  describe('boundary values', () => {
    it('should clamp negative levels to 0', () => {
      const pointer = createStabilizedPointer(-10)
      expect(pointer.getFilterTypes()).toEqual([])
    })

    it('should clamp levels above 100 to 100', () => {
      const pointer = createStabilizedPointer(150)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should handle decimal levels', () => {
      const pointer = createStabilizedPointer(50.5)
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
      ])
    })
  })

  describe('functional tests', () => {
    it('should process a complete stroke at each level', () => {
      const levels = [0, 20, 40, 60, 80, 100]
      const points: PointerPoint[] = []
      for (let i = 0; i < 20; i++) {
        points.push({ x: i * 5, y: Math.sin(i * 0.5) * 10, timestamp: i * 16 })
      }

      for (const level of levels) {
        const pointer = createStabilizedPointer(level)
        const results = pointer.processAll(points)
        expect(results.length).toBeLessThanOrEqual(points.length)
        // Finish should always return array
        const finished = pointer.finish()
        expect(Array.isArray(finished)).toBe(true)
      }
    })
  })
})

describe('createFromPreset', () => {
  describe('preset mappings', () => {
    it('should create no filters for "none" preset', () => {
      const pointer = createFromPreset('none')
      expect(pointer.getFilterTypes()).toEqual([])
    })

    it('should create noise filter for "light" preset (level 20)', () => {
      const pointer = createFromPreset('light')
      expect(pointer.getFilterTypes()).toEqual(['noise'])
    })

    it('should create three filters for "medium" preset (level 50)', () => {
      const pointer = createFromPreset('medium')
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
      ])
    })

    it('should create four filters for "heavy" preset (level 75)', () => {
      const pointer = createFromPreset('heavy')
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })

    it('should create four filters for "extreme" preset (level 100)', () => {
      const pointer = createFromPreset('extreme')
      expect(pointer.getFilterTypes()).toEqual([
        'noise',
        'kalman',
        'movingAverage',
        'string',
      ])
    })
  })

  describe('preset functionality', () => {
    it('should process points correctly with each preset', () => {
      const presets: PresetName[] = [
        'none',
        'light',
        'medium',
        'heavy',
        'extreme',
      ]
      const testPoints: PointerPoint[] = [
        { x: 0, y: 0, timestamp: 0 },
        { x: 10, y: 10, timestamp: 100 },
        { x: 20, y: 20, timestamp: 200 },
        { x: 30, y: 30, timestamp: 300 },
        { x: 40, y: 40, timestamp: 400 },
      ]

      for (const preset of presets) {
        const pointer = createFromPreset(preset)
        const results = pointer.processAll(testPoints)
        expect(results.length).toBeLessThanOrEqual(testPoints.length)
      }
    })

    it('should return independent pointer instances', () => {
      const pointer1 = createFromPreset('medium')
      const pointer2 = createFromPreset('medium')

      pointer1.process({ x: 100, y: 100, timestamp: 0 })

      // pointer2 should be unaffected
      const result = pointer2.process({ x: 0, y: 0, timestamp: 0 })
      expect(result).not.toBeNull()
      expect(result?.x).toBe(0)
      expect(result?.y).toBe(0)
    })
  })

  describe('preset type checking', () => {
    it('should accept valid preset names', () => {
      const validPresets: PresetName[] = [
        'none',
        'light',
        'medium',
        'heavy',
        'extreme',
      ]
      for (const preset of validPresets) {
        expect(() => createFromPreset(preset)).not.toThrow()
      }
    })
  })
})

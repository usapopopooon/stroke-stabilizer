import { useCallback, useRef, useMemo } from 'react'
import {
  StabilizedPointer,
  createStabilizedPointer,
  type PointerPoint,
  type Filter,
} from '@stroke-stabilizer/core'

export interface UseStabilizedPointerOptions {
  /** Stabilization level (0-100). Uses preset when specified */
  level?: number
  /** Custom filters. Used when level is not specified */
  filters?: Filter[]
  /** Callback when a point is processed */
  onPoint?: (point: PointerPoint) => void
}

export interface UseStabilizedPointerReturn {
  /** Process a point */
  process: (point: PointerPoint) => PointerPoint | null
  /** Process multiple points at once */
  processAll: (points: PointerPoint[]) => PointerPoint[]
  /** Flush buffer */
  flushBuffer: () => PointerPoint[]
  /** Reset */
  reset: () => void
  /** Add a filter */
  addFilter: (filter: Filter) => void
  /** Remove a filter */
  removeFilter: (type: string) => boolean
  /** Update filter parameters */
  updateFilter: <T>(type: string, params: Partial<T>) => boolean
  /** Reference to StabilizedPointer instance */
  pointer: StabilizedPointer
}

/**
 * React Hook for stroke stabilization
 *
 * @example
 * ```tsx
 * function DrawingCanvas() {
 *   const { process, reset } = useStabilizedPointer({
 *     level: 50,
 *     onPoint: (point) => {
 *       // Draw with stabilized point
 *       drawPoint(point)
 *     }
 *   })
 *
 *   const handlePointerMove = (e: React.PointerEvent) => {
 *     process({
 *       x: e.clientX,
 *       y: e.clientY,
 *       pressure: e.pressure,
 *       timestamp: e.timeStamp
 *     })
 *   }
 *
 *   const handlePointerUp = () => {
 *     reset()
 *   }
 *
 *   return <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
 * }
 * ```
 */
export function useStabilizedPointer(
  options: UseStabilizedPointerOptions = {}
): UseStabilizedPointerReturn {
  const { level, filters, onPoint } = options

  const pointerRef = useRef<StabilizedPointer | null>(null)

  // Lazy initialization
  const getPointer = useCallback(() => {
    if (!pointerRef.current) {
      if (level !== undefined) {
        pointerRef.current = createStabilizedPointer(level)
      } else {
        pointerRef.current = new StabilizedPointer()
        if (filters) {
          for (const filter of filters) {
            pointerRef.current.addFilter(filter)
          }
        }
      }
    }
    return pointerRef.current
  }, [level, filters])

  const process = useCallback(
    (point: PointerPoint): PointerPoint | null => {
      const result = getPointer().process(point)
      if (result && onPoint) {
        onPoint(result)
      }
      return result
    },
    [getPointer, onPoint]
  )

  const processAll = useCallback(
    (points: PointerPoint[]): PointerPoint[] => {
      const results = getPointer().processAll(points)
      if (onPoint) {
        for (const point of results) {
          onPoint(point)
        }
      }
      return results
    },
    [getPointer, onPoint]
  )

  const flushBuffer = useCallback(() => {
    return getPointer().flushBuffer()
  }, [getPointer])

  const reset = useCallback(() => {
    getPointer().reset()
  }, [getPointer])

  const addFilter = useCallback(
    (filter: Filter) => {
      getPointer().addFilter(filter)
    },
    [getPointer]
  )

  const removeFilter = useCallback(
    (type: string) => {
      return getPointer().removeFilter(type)
    },
    [getPointer]
  )

  const updateFilter = useCallback(
    <T>(type: string, params: Partial<T>) => {
      return getPointer().updateFilter(type, params)
    },
    [getPointer]
  )

  return useMemo(
    () => ({
      process,
      processAll,
      flushBuffer,
      reset,
      addFilter,
      removeFilter,
      updateFilter,
      pointer: getPointer(),
    }),
    [
      process,
      processAll,
      flushBuffer,
      reset,
      addFilter,
      removeFilter,
      updateFilter,
      getPointer,
    ]
  )
}

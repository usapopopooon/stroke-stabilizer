import type { Filter, Point, PointerPoint, UpdatableFilter } from './types'
import type { Kernel, PaddingMode } from './kernels/types'
import { smooth } from './smooth'

/**
 * Post-processor configuration
 */
interface PostProcessor {
  kernel: Kernel
  padding: PaddingMode
}

/**
 * Dynamic Pipeline Pattern implementation
 *
 * A pipeline that allows adding, removing, and updating filters at runtime.
 * Always ready to execute without requiring a .build() call.
 *
 * @example
 * ```ts
 * const pointer = new StabilizedPointer()
 *   // Real-time layer
 *   .addFilter(noiseFilter({ minDistance: 2 }))
 *   .addFilter(kalmanFilter({ processNoise: 0.1 }))
 *   // Post-processing layer
 *   .addPostProcess(gaussianKernel({ size: 7 }))
 *
 * // During drawing
 * pointer.process(point)
 *
 * // On completion
 * const finalStroke = pointer.finish()
 * ```
 */
export class StabilizedPointer {
  private filters: Filter[] = []
  private postProcessors: PostProcessor[] = []
  private buffer: PointerPoint[] = []

  /**
   * Add a filter to the pipeline
   * @returns this (for method chaining)
   */
  addFilter(filter: Filter): this {
    this.filters.push(filter)
    return this
  }

  /**
   * Remove a filter by type
   * @returns true if removed, false if not found
   */
  removeFilter(type: string): boolean {
    const index = this.filters.findIndex((f) => f.type === type)
    if (index === -1) return false
    this.filters.splice(index, 1)
    return true
  }

  /**
   * Update parameters of a filter by type
   * @returns true if updated, false if not found
   */
  updateFilter<TParams>(type: string, params: Partial<TParams>): boolean {
    const filter = this.filters.find((f) => f.type === type)
    if (!filter) return false

    if (this.isUpdatableFilter<TParams>(filter)) {
      filter.updateParams(params)
      return true
    }
    return false
  }

  /**
   * Get a filter by type
   */
  getFilter(type: string): Filter | undefined {
    return this.filters.find((f) => f.type === type)
  }

  /**
   * Get list of current filter types
   */
  getFilterTypes(): string[] {
    return this.filters.map((f) => f.type)
  }

  /**
   * Check if a filter exists
   */
  hasFilter(type: string): boolean {
    return this.filters.some((f) => f.type === type)
  }

  /**
   * Process a point through the pipeline
   * @returns Processed result (null if rejected by a filter)
   */
  process(point: PointerPoint): PointerPoint | null {
    let current: PointerPoint | null = point

    for (const filter of this.filters) {
      if (current === null) break
      current = filter.process(current)
    }

    if (current !== null) {
      this.buffer.push(current)
    }

    return current
  }

  /**
   * Process multiple points at once
   * @returns Array of processed results (nulls excluded)
   */
  processAll(points: PointerPoint[]): PointerPoint[] {
    const results: PointerPoint[] = []
    for (const point of points) {
      const result = this.process(point)
      if (result !== null) {
        results.push(result)
      }
    }
    return results
  }

  /**
   * Get the processed buffer
   */
  getBuffer(): readonly PointerPoint[] {
    return this.buffer
  }

  /**
   * Clear and return the processed buffer
   */
  flushBuffer(): PointerPoint[] {
    const flushed = [...this.buffer]
    this.buffer = []
    return flushed
  }

  /**
   * Reset all filters and buffer
   */
  reset(): void {
    for (const filter of this.filters) {
      filter.reset()
    }
    this.buffer = []
  }

  /**
   * Clear the pipeline (remove all filters)
   */
  clear(): void {
    this.filters = []
    this.postProcessors = []
    this.buffer = []
  }

  /**
   * Get number of filters
   */
  get length(): number {
    return this.filters.length
  }

  // ========================================
  // Post-processing layer
  // ========================================

  /**
   * Add post-processor to the pipeline
   * @returns this (for method chaining)
   */
  addPostProcess(
    kernel: Kernel,
    options: { padding?: PaddingMode } = {}
  ): this {
    this.postProcessors.push({
      kernel,
      padding: options.padding ?? 'reflect',
    })
    return this
  }

  /**
   * Remove a post-processor by type
   * @returns true if removed, false if not found
   */
  removePostProcess(type: string): boolean {
    const index = this.postProcessors.findIndex((p) => p.kernel.type === type)
    if (index === -1) return false
    this.postProcessors.splice(index, 1)
    return true
  }

  /**
   * Check if a post-processor exists
   */
  hasPostProcess(type: string): boolean {
    return this.postProcessors.some((p) => p.kernel.type === type)
  }

  /**
   * Get list of post-processor types
   */
  getPostProcessTypes(): string[] {
    return this.postProcessors.map((p) => p.kernel.type)
  }

  /**
   * Get number of post-processors
   */
  get postProcessLength(): number {
    return this.postProcessors.length
  }

  /**
   * Finish the stroke and return post-processed results
   * Buffer is cleared and filters are reset
   */
  finish(): Point[] {
    let points: Point[] = [...this.buffer]

    // Apply post-processors in order
    for (const processor of this.postProcessors) {
      points = smooth(points, {
        kernel: processor.kernel,
        padding: processor.padding,
      })
    }

    // Reset
    this.reset()

    return points
  }

  private isUpdatableFilter<TParams>(
    filter: Filter
  ): filter is UpdatableFilter<TParams> {
    return 'updateParams' in filter && typeof filter.updateParams === 'function'
  }
}

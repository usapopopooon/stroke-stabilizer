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
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Callback when a batch of points is processed */
  onBatch?: (points: PointerPoint[]) => void
  /** Callback for each processed point */
  onPoint?: (point: PointerPoint) => void
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

  // Batch processing fields
  private batchConfig: BatchConfig | null = null
  private pendingPoints: PointerPoint[] = []
  private rafId: number | null = null

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
   * Apply post-processors to the current buffer without resetting
   *
   * Use this to preview or re-apply post-processing with different settings.
   * The buffer is preserved, allowing multiple calls with different configurations.
   *
   * @example
   * ```ts
   * pointer.addPostProcess(gaussianKernel({ size: 5 }))
   * const preview1 = pointer.applyPostProcess()
   *
   * // Change settings and re-apply
   * pointer.removePostProcess('gaussian')
   * pointer.addPostProcess(bilateralKernel({ size: 7, sigmaValue: 10 }))
   * const preview2 = pointer.applyPostProcess()
   *
   * // Finalize when done
   * const final = pointer.finish()
   * ```
   */
  applyPostProcess(): Point[] {
    // Flush any pending batched points first
    if (this.batchConfig) {
      this.flushBatch()
    }

    let points: Point[] = [...this.buffer]

    // Apply post-processors in order
    for (const processor of this.postProcessors) {
      points = smooth(points, {
        kernel: processor.kernel,
        padding: processor.padding,
      })
    }

    return points
  }

  /**
   * Finish the stroke and return post-processed results
   * Buffer is cleared and filters are reset
   */
  finish(): Point[] {
    const points = this.applyPostProcess()
    this.reset()
    return points
  }

  // ========================================
  // Batch processing layer (rAF)
  // ========================================

  /**
   * Enable requestAnimationFrame batch processing
   *
   * When enabled, points queued via queue() are batched and processed
   * on the next animation frame, reducing CPU load for high-frequency
   * pointer events.
   *
   * @returns this (for method chaining)
   *
   * @example
   * ```ts
   * const pointer = new StabilizedPointer()
   *   .addFilter(noiseFilter({ minDistance: 2 }))
   *   .enableBatching({
   *     onBatch: (points) => drawPoints(points),
   *     onPoint: (point) => updatePreview(point)
   *   })
   *
   * canvas.onpointermove = (e) => {
   *   pointer.queue({ x: e.clientX, y: e.clientY, timestamp: e.timeStamp })
   * }
   * ```
   */
  enableBatching(config: BatchConfig = {}): this {
    this.batchConfig = config
    return this
  }

  /**
   * Disable batch processing
   * Flushes any pending points before disabling
   * @returns this (for method chaining)
   */
  disableBatching(): this {
    this.flushBatch()
    this.batchConfig = null
    return this
  }

  /**
   * Check if batch processing is enabled
   */
  get isBatchingEnabled(): boolean {
    return this.batchConfig !== null
  }

  /**
   * Queue a point for batch processing
   *
   * If batching is enabled, the point is queued and processed on the next
   * animation frame. If batching is disabled, the point is processed immediately.
   *
   * @returns this (for method chaining, useful for queueing multiple points)
   */
  queue(point: PointerPoint): this {
    if (this.batchConfig) {
      this.pendingPoints.push(point)
      this.scheduleFlush()
    } else {
      // Fallback to immediate processing
      this.process(point)
    }
    return this
  }

  /**
   * Queue multiple points for batch processing
   * @returns this (for method chaining)
   */
  queueAll(points: PointerPoint[]): this {
    if (this.batchConfig) {
      this.pendingPoints.push(...points)
      this.scheduleFlush()
    } else {
      this.processAll(points)
    }
    return this
  }

  /**
   * Force flush pending batched points immediately
   * @returns Array of processed points
   */
  flushBatch(): PointerPoint[] {
    this.cancelScheduledFlush()
    return this.processPendingPoints()
  }

  /**
   * Get number of pending points in the batch queue
   */
  get pendingCount(): number {
    return this.pendingPoints.length
  }

  // ----------------------------------------
  // Private batch processing methods
  // ----------------------------------------

  private scheduleFlush(): void {
    if (this.rafId !== null) return

    // Use rAF if available, otherwise use setTimeout as fallback
    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null
        this.processPendingPoints()
      })
    } else {
      // Node.js or non-browser environment fallback
      this.rafId = setTimeout(() => {
        this.rafId = null
        this.processPendingPoints()
      }, 16) as unknown as number
    }
  }

  private cancelScheduledFlush(): void {
    if (this.rafId === null) return

    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId)
    } else {
      clearTimeout(this.rafId)
    }
    this.rafId = null
  }

  private processPendingPoints(): PointerPoint[] {
    if (this.pendingPoints.length === 0) return []

    const points = this.pendingPoints
    this.pendingPoints = []

    const results: PointerPoint[] = []

    for (const point of points) {
      const result = this.process(point)
      if (result !== null) {
        results.push(result)
        // Call onPoint callback for each processed point
        this.batchConfig?.onPoint?.(result)
      }
    }

    // Call onBatch callback with all processed points
    if (results.length > 0) {
      this.batchConfig?.onBatch?.(results)
    }

    return results
  }

  private isUpdatableFilter<TParams>(
    filter: Filter
  ): filter is UpdatableFilter<TParams> {
    return 'updateParams' in filter && typeof filter.updateParams === 'function'
  }
}

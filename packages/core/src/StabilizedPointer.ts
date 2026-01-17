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
 * StabilizedPointer configuration options
 */
export interface StabilizedPointerOptions {
  /**
   * Whether to append the raw endpoint when finishing a stroke.
   * This ensures the stabilized stroke ends at the actual input point.
   * @default true
   */
  appendEndpoint?: boolean
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
  private lastRawPoint: PointerPoint | null = null

  // Configuration options
  private options: Required<StabilizedPointerOptions>

  // Batch processing fields
  private batchConfig: BatchConfig | null = null
  private pendingPoints: PointerPoint[] = []
  private rafId: number | null = null

  /**
   * Create a new StabilizedPointer
   * @param options Configuration options
   */
  constructor(options: StabilizedPointerOptions = {}) {
    this.options = {
      appendEndpoint: options.appendEndpoint ?? true,
    }
  }

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
    // Save raw input for convergence on finish
    this.lastRawPoint = point

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
   * Reset all filters and clear the buffer
   *
   * Call this to prepare for a new stroke without destroying the pipeline configuration.
   * Filters are reset to their initial state and the buffer is cleared.
   *
   * @example
   * ```ts
   * // After finishing a stroke
   * const result = pointer.finish() // automatically calls reset()
   *
   * // Or manually reset without finishing
   * pointer.reset()
   * ```
   */
  reset(): void {
    for (const filter of this.filters) {
      filter.reset()
    }
    this.buffer = []
    this.lastRawPoint = null
    this.hasDrained = false
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
   * Finish the stroke and return post-processed results, without resetting
   *
   * Use this when you want to get the final result but keep the buffer intact.
   * Useful for previewing post-processing results or comparing different settings.
   *
   * @example
   * ```ts
   * pointer.addPostProcess(gaussianKernel({ size: 5 }))
   * const preview1 = pointer.finishWithoutReset()
   *
   * // Change settings and re-apply
   * pointer.removePostProcess('gaussian')
   * pointer.addPostProcess(bilateralKernel({ size: 7, sigmaValue: 10 }))
   * const preview2 = pointer.finishWithoutReset()
   *
   * // Finalize when done
   * const final = pointer.finish()
   * ```
   */
  finishWithoutReset(): Point[] {
    // Flush any pending batched points first
    if (this.batchConfig) {
      this.flushBatch()
    }

    // Append endpoint to ensure stroke ends at actual input point
    this.appendEndpoint()

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
   * Track if drain has been called to avoid duplicate draining
   */
  private hasDrained = false

  /**
   * Append the final raw input point to ensure stroke ends at the actual endpoint
   *
   * Instead of draining filters (which adds many extra points),
   * we simply append the raw endpoint. The post-processing phase
   * with bidirectional convolution will naturally smooth the transition.
   */
  private appendEndpoint(): void {
    // Skip if disabled via options
    if (!this.options.appendEndpoint) {
      return
    }
    // Avoid duplicate appending (finishWithoutReset may be called multiple times)
    if (this.hasDrained) {
      return
    }
    if (this.lastRawPoint === null || this.buffer.length === 0) {
      return
    }

    this.hasDrained = true

    const target = this.lastRawPoint
    const lastBufferPoint = this.buffer[this.buffer.length - 1]

    // Calculate distance between last stabilized point and target
    const dx = target.x - lastBufferPoint.x
    const dy = target.y - lastBufferPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // If already close enough, no need to append
    if (distance < 1) {
      return
    }

    // Append the raw endpoint directly to the buffer
    // Post-processing (Gaussian, etc.) will smooth the transition
    this.buffer.push({
      x: target.x,
      y: target.y,
      pressure: target.pressure ?? 1,
      timestamp: target.timestamp + 8,
    })
  }

  /**
   * Finish the stroke and return post-processed results
   *
   * This applies all post-processors to the buffer, then resets filters and clears the buffer.
   * Use this at the end of a stroke to get the final smoothed result.
   *
   * @example
   * ```ts
   * // During drawing
   * pointer.process(point)
   *
   * // On stroke end
   * const finalStroke = pointer.finish()
   * ```
   */
  finish(): Point[] {
    const points = this.finishWithoutReset()
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

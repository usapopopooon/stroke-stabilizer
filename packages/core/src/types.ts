/**
 * 2D coordinate point
 */
export interface Point {
  x: number
  y: number
}

/**
 * Pointer input point with timestamp
 */
export interface PointerPoint extends Point {
  pressure?: number
  timestamp: number
}

/**
 * Base interface for filters
 */
export interface Filter {
  readonly type: string
  process(point: PointerPoint): PointerPoint | null
  reset(): void
}

/**
 * Interface for filters with updatable parameters
 */
export interface UpdatableFilter<TParams = unknown> extends Filter {
  updateParams(params: Partial<TParams>): void
}

/**
 * Type for filter factory functions
 */
export type FilterFactory<TParams = unknown> = (params: TParams) => Filter

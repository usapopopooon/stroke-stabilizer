// Core
export { StabilizedPointer } from './StabilizedPointer'
export type { BatchConfig } from './StabilizedPointer'

// Types
export type {
  Point,
  PointerPoint,
  Filter,
  UpdatableFilter,
  FilterFactory,
} from './types'

// Filters
export {
  noiseFilter,
  kalmanFilter,
  movingAverageFilter,
  stringFilter,
  emaFilter,
  oneEuroFilter,
  linearPredictionFilter,
} from './filters'

export type {
  NoiseFilterParams,
  KalmanFilterParams,
  MovingAverageFilterParams,
  StringFilterParams,
  EmaFilterParams,
  OneEuroFilterParams,
  LinearPredictionFilterParams,
} from './filters'

// Presets
export { createStabilizedPointer, createFromPreset } from './presets'

export type { PresetName } from './presets'

// Kernels (for post-process)
export {
  gaussianKernel,
  boxKernel,
  triangleKernel,
  bilateralKernel,
  isAdaptiveKernel,
} from './kernels'

export type {
  Kernel,
  AdaptiveKernel,
  AnyKernel,
  PaddingMode,
  SmoothOptions,
  GaussianKernelParams,
  BoxKernelParams,
  TriangleKernelParams,
  BilateralKernel,
  BilateralKernelParams,
} from './kernels'

// Smooth function
export { smooth } from './smooth'

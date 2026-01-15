# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-15

### Added

#### @stroke-stabilizer/core
- **rAF Batch Processing** - requestAnimationFrame-based batching for high-frequency pointer events
  - `enableBatching(config)` - Enable batch processing with optional callbacks
  - `disableBatching()` - Disable batch processing (flushes pending points)
  - `queue(point)` - Queue a point for batch processing
  - `queueAll(points)` - Queue multiple points
  - `flushBatch()` - Force process pending points immediately
  - `isBatchingEnabled` - Check if batching is enabled
  - `pendingCount` - Get number of pending points
- `BatchConfig` type export for TypeScript users

### Changed

- All method chaining APIs now support batching methods seamlessly
- `finish()` now automatically flushes pending batched points before post-processing

### Infrastructure

- Added `.claude/` to .gitignore
- Volta pin for Node.js LTS
- Test count increased to 128 (added 23 batch processing tests)

## [0.1.2] - 2026-01-15

### Added

- LICENSE file

## [0.1.1] - 2026-01-15

### Added

#### @stroke-stabilizer/core
- **Dynamic Pipeline Pattern** - Flexible real-time filter chain architecture
- **StabilizedPointer** - Main class for managing filter pipelines
- **7 Built-in Filters:**
  - `noiseFilter` - Minimum distance threshold for noise rejection
  - `movingAverageFilter` - Simple moving average smoothing
  - `emaFilter` - Exponential Moving Average with configurable alpha
  - `kalmanFilter` - 1D Kalman filter for optimal state estimation
  - `oneEuroFilter` - Speed-adaptive low-pass filter (low latency at high speed)
  - `stringFilter` - "Lazy brush" effect with virtual string
  - `linearPredictionFilter` - Velocity-based position prediction
- **4 Convolution Kernels for Post-processing:**
  - `gaussianKernel` - Gaussian-weighted smoothing
  - `boxKernel` - Uniform weight (simple averaging)
  - `triangleKernel` - Center-weighted linear falloff
  - `bilateralKernel` - Adaptive edge-preserving smoothing
- **smooth()** - Bidirectional convolution function with padding modes
- **createStabilizedPointer()** - Level-based preset factory (0-100)
- Full TypeScript support with comprehensive type definitions

#### @stroke-stabilizer/react
- `useStabilizedPointer` - React hook for stroke stabilization
- `useStabilizationLevel` - React hook for managing stabilization level state

#### @stroke-stabilizer/vue
- `useStabilizedPointer` - Vue composable for stroke stabilization
- `useStabilizationLevel` - Vue composable for managing stabilization level state

### Infrastructure
- pnpm monorepo with workspace support
- Vite build system with dual CJS/ESM output
- Vitest test framework (105 tests)
- ESLint + Prettier configuration
- TypeScript strict mode

[0.2.0]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.0
[0.1.2]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.2
[0.1.1]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.1

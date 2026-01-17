# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-01-17

Initial release.

### @stroke-stabilizer/core

#### Features

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - Add, remove, and update filters at runtime without rebuilding
- **Two-layer Processing** - Real-time filters + post-processing convolution
- **rAF Batch Processing** - Coalesce high-frequency pointer events into animation frames
- **Edge-preserving Smoothing** - Bilateral kernel for sharp corner preservation
- **TypeScript First** - Full type safety with exported types
- **Zero Dependencies** - Pure JavaScript, works anywhere

#### Real-time Filters

- `noiseFilter` - Minimum distance threshold for noise rejection
- `movingAverageFilter` - Simple moving average (FIR) smoothing
- `emaFilter` - Exponential Moving Average (IIR) with configurable alpha
- `kalmanFilter` - Position-only Kalman filter optimized for high-frequency input
- `oneEuroFilter` - Speed-adaptive low-pass filter (low latency at high speed)
- `stringFilter` - "Lazy brush" effect with virtual string
- `linearPredictionFilter` - Velocity-based position prediction

#### Post-processing Kernels

- `gaussianKernel` - Gaussian-weighted smoothing
- `boxKernel` - Uniform weight (simple averaging)
- `triangleKernel` - Center-weighted linear falloff
- `bilateralKernel` - Adaptive edge-preserving smoothing

#### API

- `StabilizedPointer` - Main class for managing filter pipelines
- `smooth()` - Bidirectional convolution with padding modes and endpoint preservation
- `createFromPreset()` - Level-based preset factory (0-100)
- `finish()` / `finishWithoutReset()` - Post-processing with/without buffer reset

### @stroke-stabilizer/react

- `useStabilizedPointer` - React hook for stroke stabilization
- `useStabilizationLevel` - React hook for managing stabilization level state

### @stroke-stabilizer/vue

- `useStabilizedPointer` - Vue composable for stroke stabilization
- `useStabilizationLevel` - Vue composable for managing stabilization level state

### Documentation

- Filter reference with mathematical formulas (`docs/filters.md`, `docs/filters.ja.md`)
- Full Japanese documentation for all packages
- Example applications for Vanilla JS, React, and Vue

### Infrastructure

- pnpm monorepo with workspace support
- Vite build system with dual CJS/ESM output
- Vitest test framework (150+ tests)
- GitHub Actions CI workflow
- ESLint + Prettier + cspell configuration
- TypeScript strict mode

[0.1.3]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.3

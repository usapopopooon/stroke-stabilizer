# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.15] - 2026-01-18

### Changed

- Add getCoalescedEvents() to rAF Batch Processing examples in React and Vue READMEs

## [0.2.14] - 2026-01-18

### Changed

- Add getCoalescedEvents() documentation to React and Vue package READMEs

## [0.2.13] - 2026-01-18

### Changed

- Add getCoalescedEvents() support to all examples for smoother stroke input
- Add getCoalescedEvents() documentation section to core READMEs

## [0.2.12] - 2026-01-17

### Fixed

- Fix canvas container layout in React and Vue examples
- Fix React example stroke rendering issue (strokes disappearing after drawing)

## [0.2.11] - 2026-01-17

### Changed

- Migrate from pnpm to npm workspaces
- Add examples to npm workspaces
- Add parameter guidelines to filter reference documentation
- Add live demo links to each package README
- Improve Japanese documentation readability

## [0.2.10] - 2026-01-17

### Fixed

- Fix workspace: protocol in dependencies (npm incompatible)

## [0.2.9] - 2026-01-17

### Changed

- Version bump for npm registry compatibility (same as 0.1.6)

## [0.1.6] - 2026-01-17

### Added

- `StabilizedPointerOptions` with `appendEndpoint` option for automatic endpoint correction
- Interactive examples with dynamic filter controls (checkboxes and sliders)
- GitHub Pages deployment for live demos
- Live demo links in documentation

### Changed

- Examples now use `workspace:*` for local package references
- Updated documentation with `finish()` method usage and `StabilizedPointerOptions`

## [0.1.5] - 2026-01-17

### Changed

- Rescaled preset parameters: level 2 now equals maximum effect (previously level 4)

## [0.1.4] - 2026-01-17

### Changed

- Rescaled preset parameters: level 4 now equals maximum effect (previously level 100)
- This makes the stabilization feel more natural at typical slider values (1-10)

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

[0.2.15]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.15
[0.2.14]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.14
[0.2.13]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.13
[0.2.12]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.12
[0.2.11]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.11
[0.2.10]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.10
[0.2.9]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.2.9
[0.1.6]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.6
[0.1.5]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.5
[0.1.4]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.4
[0.1.3]: https://github.com/usapopopooon/stroke-stabilizer/releases/tag/v0.1.3

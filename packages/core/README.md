# @stroke-stabilizer/core
[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)

> Part of the [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) monorepo

A lightweight, framework-agnostic stroke stabilization library for digital drawing applications.

Reduce hand tremor and smooth pen/mouse input in real-time using a flexible filter pipeline.

## Features

- **Dynamic Pipeline Pattern** - Add, remove, and update filters at runtime without rebuilding
- **Two-layer Processing** - Real-time filters + post-processing convolution
- **8 Built-in Filters** - From simple moving average to adaptive One Euro Filter
- **Edge-preserving Smoothing** - Bilateral kernel for sharp corner preservation
- **TypeScript First** - Full type safety with exported types
- **Zero Dependencies** - Pure JavaScript, works anywhere

## Installation

```bash
npm install @stroke-stabilizer/core
```

## Quick Start

```ts
import {
  StabilizedPointer,
  emaFilter,
  oneEuroFilter,
} from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(emaFilter({ alpha: 0.5 }))
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))

canvas.addEventListener('pointermove', (e) => {
  const result = pointer.process({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })

  if (result) {
    draw(result.x, result.y)
  }
})

canvas.addEventListener('pointerup', () => {
  pointer.reset()
})
```

## Filters

### Real-time Filters

| Filter                   | Description                       | Use Case                           |
| ------------------------ | --------------------------------- | ---------------------------------- |
| `noiseFilter`            | Rejects points too close together | Remove jitter                      |
| `movingAverageFilter`    | Simple moving average (FIR)       | Basic smoothing                    |
| `emaFilter`              | Exponential moving average (IIR)  | Low-latency smoothing              |
| `kalmanFilter`           | Kalman filter                     | Noisy input with velocity          |
| `stringFilter`           | Lazy Brush algorithm              | Delayed, smooth strokes            |
| `oneEuroFilter`          | Adaptive lowpass filter           | Best balance of smoothness/latency |
| `linearPredictionFilter` | Predicts next position            | Lag compensation                   |

### Post-processing Kernels

| Kernel            | Description               |
| ----------------- | ------------------------- |
| `gaussianKernel`  | Gaussian blur             |
| `boxKernel`       | Simple average            |
| `triangleKernel`  | Linear falloff            |
| `bilateralKernel` | Edge-preserving smoothing |

## Usage Examples

### Basic Real-time Stabilization

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer().addFilter(
  oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
)

// Process each point
const smoothed = pointer.process({ x, y, timestamp })
```

### Dynamic Filter Updates

```ts
// Add filter
pointer.addFilter(emaFilter({ alpha: 0.3 }))

// Update parameters at runtime
pointer.updateFilter('ema', { alpha: 0.5 })

// Remove filter
pointer.removeFilter('ema')
```

### Post-processing with Bidirectional Convolution

```ts
import { StabilizedPointer, gaussianKernel } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .addPostProcess(gaussianKernel({ size: 7 }), { padding: 'reflect' })

// Process points in real-time
pointer.process(point)

// After stroke ends, apply post-processing
const finalPoints = pointer.finish()
```

### Edge-preserving Smoothing

```ts
import { smooth, bilateralKernel } from '@stroke-stabilizer/core'

// Smooth while preserving sharp corners
const smoothed = smooth(points, {
  kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
  padding: 'reflect',
})
```

### Presets

```ts
import { createFromPreset } from '@stroke-stabilizer/core'

// Quick setup with predefined configurations
const pointer = createFromPreset('smooth') // Heavy smoothing
const pointer = createFromPreset('responsive') // Low latency
const pointer = createFromPreset('balanced') // Default balance
```

## Filter Parameters

### oneEuroFilter (Recommended)

```ts
oneEuroFilter({
  minCutoff: 1.0, // Smoothing at low speed (lower = smoother)
  beta: 0.007, // Speed adaptation (higher = more responsive)
  dCutoff: 1.0, // Derivative cutoff (usually 1.0)
})
```

### emaFilter

```ts
emaFilter({
  alpha: 0.5, // 0-1, higher = more responsive
})
```

### kalmanFilter

```ts
kalmanFilter({
  processNoise: 0.1, // Expected movement variance
  measurementNoise: 0.5, // Input noise level
})
```

### linearPredictionFilter

```ts
linearPredictionFilter({
  historySize: 4, // Points used for prediction
  predictionFactor: 0.5, // Prediction strength (0-1)
  smoothing: 0.6, // Output smoothing
})
```

### stringFilter (Lazy Brush)

```ts
stringFilter({
  stringLength: 10, // Distance before anchor moves
})
```

### bilateralKernel

```ts
bilateralKernel({
  size: 7, // Kernel size (odd number)
  sigmaValue: 10, // Edge preservation (lower = sharper edges)
  sigmaSpace: 2, // Spatial falloff (optional)
})
```

## API Reference

### StabilizedPointer

```ts
class StabilizedPointer {
  // Filter management
  addFilter(filter: Filter): this
  removeFilter(type: string): boolean
  updateFilter<T>(type: string, params: Partial<T>): boolean
  getFilter(type: string): Filter | undefined

  // Post-processing
  addPostProcess(kernel: Kernel, options?: { padding?: PaddingMode }): this
  removePostProcess(type: string): boolean

  // Processing
  process(point: PointerPoint): PointerPoint | null
  finish(): Point[]
  reset(): void
}
```

### Types

```ts
interface Point {
  x: number
  y: number
}

interface PointerPoint extends Point {
  pressure?: number
  timestamp: number
}

type PaddingMode = 'reflect' | 'edge' | 'zero'
```

## Architecture

```
Input → [Real-time Filters] → process() → Output
                                ↓
                            [Buffer]
                                ↓
                      [Post-processors] → finish() → Final Output
```

**Real-time filters** run on each input point with O(1) complexity.
**Post-processors** run once at stroke end with bidirectional convolution.

## Framework Adapters

- `@stroke-stabilizer/react` - React hooks
- `@stroke-stabilizer/vue` - Vue composables

## References

- [The Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)
- [1€ Filter Paper](https://cristal.univ-lille.fr/~casiez/1euro/)
- [Lazy Brush Algorithm](https://github.com/lazybrush/lazy-brush)

## License

MIT

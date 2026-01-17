# @stroke-stabilizer/core

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)

[日本語](./docs/README.ja.md)

> This is part of the [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) monorepo

A lightweight, framework-agnostic stroke stabilization library for digital drawing applications.

Reduce hand tremor and smooth pen/mouse input in real-time using a flexible filter pipeline.

## Features

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - Add, remove, and update filters at runtime without rebuilding
- **Two-layer Processing** - Real-time filters + post-processing convolution
- **rAF Batch Processing** - Coalesce high-frequency pointer events into animation frames
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

> **📖 [Detailed Filter Reference](../../docs/filters.md)** - Mathematical formulas, technical explanations, and usage recommendations

### Real-time Filters

| Filter                   | Description                       | Use Case                           |
| ------------------------ | --------------------------------- | ---------------------------------- |
| `noiseFilter`            | Rejects points too close together | Remove jitter                      |
| `movingAverageFilter`    | Simple moving average (FIR)       | Basic smoothing                    |
| `emaFilter`              | Exponential moving average (IIR)  | Low-latency smoothing              |
| `kalmanFilter`           | Kalman filter                     | Noisy input smoothing              |
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

### Re-applying Post-processing

Use `finishWithoutReset()` to preview or re-apply post-processing with different settings without losing the buffer.

```ts
import {
  StabilizedPointer,
  gaussianKernel,
  bilateralKernel,
} from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()

// Process points
pointer.process(point1)
pointer.process(point2)
pointer.process(point3)

// Preview with gaussian kernel
pointer.addPostProcess(gaussianKernel({ size: 5 }))
const preview1 = pointer.finishWithoutReset()
draw(preview1)

// Change to bilateral kernel and re-apply
pointer.removePostProcess('gaussian')
pointer.addPostProcess(bilateralKernel({ size: 7, sigmaValue: 10 }))
const preview2 = pointer.finishWithoutReset()
draw(preview2)

// Finalize when satisfied (resets buffer)
const final = pointer.finish()
```

**Difference between `finishWithoutReset()` and `finish()`:**

| Method                 | Post-process | Reset buffer |
| ---------------------- | ------------ | ------------ |
| `finishWithoutReset()` | ✅           | ❌           |
| `finish()`             | ✅           | ✅           |

### Edge-preserving Smoothing

```ts
import { smooth, bilateralKernel } from '@stroke-stabilizer/core'

// Smooth while preserving sharp corners
const smoothed = smooth(points, {
  kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
  padding: 'reflect',
})
```

### Endpoint Preservation

By default, `smooth()` preserves exact start and end points so the stroke reaches the actual pointer position.

```ts
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

// Default: endpoints preserved (recommended)
const smoothed = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
})

// Disable endpoint preservation
const smoothedAll = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
  preserveEndpoints: false,
})
```

### rAF Batch Processing

For high-frequency input devices (pen tablets, etc.), batch processing reduces CPU load by coalescing pointer events into animation frames.

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .enableBatching({
    onBatch: (points) => {
      // Called once per frame with all processed points
      drawPoints(points)
    },
    onPoint: (point) => {
      // Called for each processed point (optional)
      updatePreview(point)
    },
  })

canvas.addEventListener('pointermove', (e) => {
  // Points are queued and processed on next animation frame
  pointer.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
})

canvas.addEventListener('pointerup', () => {
  // Flush any pending points and apply post-processing
  const finalPoints = pointer.finish()
})
```

**Batch processing methods:**

```ts
// Enable/disable batching (method chaining)
pointer.enableBatching({ onBatch, onPoint })
pointer.disableBatching()

// Queue points for batch processing
pointer.queue(point)
pointer.queueAll(points)

// Force immediate processing
pointer.flushBatch()

// Check state
pointer.isBatchingEnabled // boolean
pointer.pendingCount // number of queued points
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
  finish(): Point[] // Apply post-process and reset
  finishWithoutReset(): Point[] // Apply post-process without reset (for preview)
  reset(): void // Reset filters and clear buffer

  // Batch processing (rAF)
  enableBatching(config?: BatchConfig): this
  disableBatching(): this
  queue(point: PointerPoint): this
  queueAll(points: PointerPoint[]): this
  flushBatch(): PointerPoint[]
  isBatchingEnabled: boolean
  pendingCount: number
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

interface BatchConfig {
  onBatch?: (points: PointerPoint[]) => void
  onPoint?: (point: PointerPoint) => void
}
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

## License

[MIT](../../LICENSE)

# stroke-stabilizer

[日本語](./docs/README.ja.md)

A monorepo for stroke stabilization libraries for digital drawing applications.

## Packages

| Package | Version | Description |
| ------- | ------- | ----------- |
| [@stroke-stabilizer/core](./packages/core) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core) | Core library (vanilla JS) |
| [@stroke-stabilizer/react](./packages/react) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react) | React hooks |
| [@stroke-stabilizer/vue](./packages/vue) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue) | Vue composables |

## Features

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - Add, remove, and update filters at runtime
- **Two-layer Processing** - Real-time filters + post-processing convolution
- **rAF Batch Processing** - Coalesce high-frequency pointer events into animation frames
- **8 Built-in Filters** - From simple moving average to adaptive One Euro Filter
- **Edge-preserving Smoothing** - Bilateral kernel for sharp corner preservation
- **TypeScript First** - Full type safety
- **Zero Dependencies** - Pure JavaScript

## Quick Start

```bash
npm install @stroke-stabilizer/core
```

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .enableBatching({
    onBatch: (points) => drawPoints(points),
  })

canvas.addEventListener('pointermove', (e) => {
  pointer.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
})
```

See [@stroke-stabilizer/core README](./packages/core/README.md) for full documentation.

## License

[MIT](./LICENSE)

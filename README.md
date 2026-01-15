# stroke-stabilizer

A monorepo for stroke stabilization libraries for digital drawing applications.

## Packages

| Package | Version | Description |
| ------- | ------- | ----------- |
| [@stroke-stabilizer/core](./packages/core) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core) | Core library (vanilla JS) |
| [@stroke-stabilizer/react](./packages/react) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react) | React hooks |
| [@stroke-stabilizer/vue](./packages/vue) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue) | Vue composables |

## Features

- **Dynamic Pipeline Pattern** - Add, remove, and update filters at runtime
- **Two-layer Processing** - Real-time filters + post-processing convolution
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

const pointer = new StabilizedPointer().addFilter(
  oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
)

canvas.addEventListener('pointermove', (e) => {
  const result = pointer.process({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
  if (result) draw(result.x, result.y)
})
```

See [@stroke-stabilizer/core README](./packages/core/README.md) for full documentation.

## License

[MIT](./LICENSE)

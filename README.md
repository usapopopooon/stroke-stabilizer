# stroke-stabilizer

[日本語](./docs/README.ja.md)

A monorepo for stroke stabilization libraries for digital drawing applications.

## Packages

| Package                                      | Version                                                                                                                     | Description               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [@stroke-stabilizer/core](./packages/core)   | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)   | Core library (vanilla JS) |
| [@stroke-stabilizer/react](./packages/react) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react) | React hooks               |
| [@stroke-stabilizer/vue](./packages/vue)     | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)     | Vue composables           |

## Live Demo

Try the interactive demos: **[usapopopooon.github.io/stroke-stabilizer](https://usapopopooon.github.io/stroke-stabilizer/)**

## Examples

Interactive demos with dynamic filter controls:

- [Vanilla JS](./examples/vanilla/) - Pure JavaScript implementation
- [React](./examples/react/) - React hooks example
- [Vue](./examples/vue/) - Vue composables example

## Documentation

- **[Filter Reference](./docs/filters.md)** - Detailed explanation of all filters and kernels with mathematical formulas

## Features

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - Add, remove, and update filters at runtime
- **Two-layer Processing** - Real-time filters + post-processing convolution
- **Automatic Endpoint Correction** - Strokes end at the actual input point
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

const pointer = new StabilizedPointer().addFilter(
  oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
)

canvas.addEventListener('pointermove', (e) => {
  // IMPORTANT: Use getCoalescedEvents() for smoother input
  const events = e.getCoalescedEvents?.() ?? [e]

  for (const ce of events) {
    const result = pointer.process({
      x: ce.offsetX,
      y: ce.offsetY,
      pressure: ce.pressure,
      timestamp: ce.timeStamp,
    })
    if (result) draw(result.x, result.y)
  }
})
```

> **Important:** Always use `getCoalescedEvents()` to capture all pointer events between frames. Without it, browsers throttle events and you'll get choppy strokes.

See [@stroke-stabilizer/core README](./packages/core/README.md) for full documentation.

## License

[MIT](./LICENSE)

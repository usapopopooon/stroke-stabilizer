# @stroke-stabilizer/react
[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react)

> Part of the [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) monorepo

React hooks for stroke stabilization in digital drawing applications.

## Installation

```bash
npm install @stroke-stabilizer/react @stroke-stabilizer/core
```

## Usage

### useStabilizedPointer

```tsx
import { useStabilizedPointer } from '@stroke-stabilizer/react'
import { oneEuroFilter } from '@stroke-stabilizer/core'

function DrawingCanvas() {
  const pointer = useStabilizedPointer([
    oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }),
  ])

  const handlePointerMove = (e: React.PointerEvent) => {
    const result = pointer.process({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    })

    if (result) {
      draw(result.x, result.y)
    }
  }

  const handlePointerUp = () => {
    const finalPoints = pointer.finish()
    // Use finalPoints for final stroke
    pointer.reset()
  }

  return (
    <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
  )
}
```

### useStabilizationLevel

A simpler hook with preset levels.

```tsx
import { useStabilizationLevel } from '@stroke-stabilizer/react'

function DrawingCanvas() {
  const pointer = useStabilizationLevel('balanced')
  // 'smooth' | 'responsive' | 'balanced'

  // ... same usage as useStabilizedPointer
}
```

## API

### useStabilizedPointer(filters?)

Creates a stabilized pointer instance.

- `filters` - Optional array of filters to apply

Returns a `StabilizedPointer` instance.

### useStabilizationLevel(level)

Creates a stabilized pointer with a preset configuration.

- `level` - `'smooth'` | `'responsive'` | `'balanced'`

Returns a `StabilizedPointer` instance.

## License

[MIT](../../LICENSE)

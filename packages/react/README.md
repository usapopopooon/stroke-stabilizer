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
  const { process, reset, pointer } = useStabilizedPointer({
    level: 50,
    onPoint: (point) => {
      draw(point.x, point.y)
    },
  })

  const handlePointerMove = (e: React.PointerEvent) => {
    process({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    })
  }

  const handlePointerUp = () => {
    reset()
  }

  return (
    <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
  )
}
```

### With rAF Batch Processing

For high-frequency input devices, use the underlying `StabilizedPointer`'s batch processing:

```tsx
import { useStabilizedPointer } from '@stroke-stabilizer/react'
import { useEffect } from 'react'

function DrawingCanvas() {
  const { pointer } = useStabilizedPointer({ level: 50 })

  useEffect(() => {
    pointer.enableBatching({
      onBatch: (points) => drawPoints(points),
    })
    return () => pointer.disableBatching()
  }, [pointer])

  const handlePointerMove = (e: React.PointerEvent) => {
    pointer.queue({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    })
  }

  return <canvas onPointerMove={handlePointerMove} />
}
```

### useStabilizationLevel

A hook for managing stabilization level state.

```tsx
import { useStabilizationLevel } from '@stroke-stabilizer/react'

function StabilizationSlider() {
  const { level, setLevel, isEnabled } = useStabilizationLevel({
    initialLevel: 50,
  })

  return (
    <div>
      <input
        type="range"
        min={0}
        max={100}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value))}
      />
      <span>{level}%</span>
      {isEnabled && <span>Stabilization enabled</span>}
    </div>
  )
}
```

## API

### useStabilizedPointer(options?)

Creates a stabilized pointer instance.

**Options:**

- `level` - Stabilization level (0-100). Uses preset when specified
- `filters` - Custom filter array. Used when level is not specified
- `onPoint` - Callback when a point is processed

**Returns:**

- `process(point)` - Process a single point
- `processAll(points)` - Process multiple points
- `flushBuffer()` - Flush internal buffer
- `reset()` - Reset the pointer state
- `addFilter(filter)` - Add a filter dynamically
- `removeFilter(type)` - Remove a filter by type
- `updateFilter(type, params)` - Update filter parameters
- `pointer` - Reference to the StabilizedPointer instance

### useStabilizationLevel(options?)

Manages stabilization level state.

**Options:**

- `initialLevel` - Initial level (default: 0)
- `min` - Minimum level (default: 0)
- `max` - Maximum level (default: 100)
- `onChange` - Callback when level changes

**Returns:**

- `level` - Current level
- `setLevel(value)` - Set the level
- `increase(amount?)` - Increase level by amount (default: 10)
- `decrease(amount?)` - Decrease level by amount (default: 10)
- `isEnabled` - Whether stabilization is active (level > 0)

## License

[MIT](../../LICENSE)

# @stroke-stabilizer/vue
[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)

> Part of the [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) monorepo

Vue composables for stroke stabilization in digital drawing applications.

## Installation

```bash
npm install @stroke-stabilizer/vue @stroke-stabilizer/core
```

## Usage

### useStabilizedPointer

```vue
<script setup lang="ts">
import { useStabilizedPointer } from '@stroke-stabilizer/vue'
import { oneEuroFilter } from '@stroke-stabilizer/core'

const { process, reset, finish } = useStabilizedPointer({
  filters: [oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })],
  onPoint: (point) => {
    draw(point.x, point.y)
  },
})

function handlePointerMove(e: PointerEvent) {
  process({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
}

function handlePointerUp() {
  const finalPoints = finish()
  // Use finalPoints for final stroke
  reset()
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" @pointerup="handlePointerUp" />
</template>
```

### useStabilizationLevel

A composable for managing stabilization level with reactive state.

```vue
<script setup lang="ts">
import {
  useStabilizationLevel,
  useStabilizedPointer,
} from '@stroke-stabilizer/vue'

const { level, setLevel, isEnabled } = useStabilizationLevel({
  initialLevel: 50,
  onChange: (newLevel) => console.log('Level changed:', newLevel),
})

const { process, reset } = useStabilizedPointer({
  level: level.value,
})
</script>

<template>
  <div>
    <input
      type="range"
      :min="0"
      :max="100"
      :value="level"
      @input="setLevel(Number(($event.target as HTMLInputElement).value))"
    />
    <span>{{ level }}%</span>
    <span v-if="isEnabled">Stabilization enabled</span>
  </div>
</template>
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
- `pointer` - Computed ref to the StabilizedPointer instance
- `filterCount` - Computed ref to the number of active filters

### useStabilizationLevel(options?)

Manages stabilization level state.

**Options:**

- `initialLevel` - Initial level (default: 0)
- `min` - Minimum level (default: 0)
- `max` - Maximum level (default: 100)
- `onChange` - Callback when level changes

**Returns:**

- `level` - Computed ref to current level
- `setLevel(value)` - Set the level
- `increase(amount?)` - Increase level by amount (default: 10)
- `decrease(amount?)` - Decrease level by amount (default: 10)
- `isEnabled` - Computed ref indicating if stabilization is active

## License

[MIT](../../LICENSE)

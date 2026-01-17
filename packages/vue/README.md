# @stroke-stabilizer/vue

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)

[日本語](./docs/README.ja.md)

> This is part of the [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) monorepo

Vue composables for stroke stabilization in digital drawing applications.

**[Live Demo](https://usapopopooon.github.io/stroke-stabilizer/vue/)**

## Installation

```bash
npm install @stroke-stabilizer/vue @stroke-stabilizer/core
```

## Usage

### useStabilizedPointer

```vue
<script setup lang="ts">
import { useStabilizedPointer } from '@stroke-stabilizer/vue'

const { process, reset, pointer } = useStabilizedPointer({
  level: 50,
  onPoint: (point) => {
    draw(point.x, point.y)
  },
})

function handlePointerMove(e: PointerEvent) {
  // IMPORTANT: Use getCoalescedEvents() for smoother input
  const events = e.getCoalescedEvents?.() ?? [e]

  for (const ce of events) {
    process({
      x: ce.offsetX,
      y: ce.offsetY,
      pressure: ce.pressure,
      timestamp: ce.timeStamp,
    })
  }
}

function handlePointerUp() {
  // Get final smoothed points with post-processing
  const finalPoints = pointer.value.finish()
  drawFinalStroke(finalPoints)
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" @pointerup="handlePointerUp" />
</template>
```

### With rAF Batch Processing

For high-frequency input devices, use the underlying `StabilizedPointer`'s batch processing:

```vue
<script setup lang="ts">
import { useStabilizedPointer } from '@stroke-stabilizer/vue'
import { onMounted, onUnmounted } from 'vue'

const { pointer } = useStabilizedPointer({ level: 50 })

onMounted(() => {
  pointer.value.enableBatching({
    onBatch: (points) => drawPoints(points),
  })
})

onUnmounted(() => {
  pointer.value.disableBatching()
})

function handlePointerMove(e: PointerEvent) {
  pointer.value.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" />
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
- `finish()` - Apply post-processing and return final points (auto-appends endpoint)
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
- `isEnabled` - Computed ref indicating if stabilization is active (level > 0)

## License

[MIT](../../LICENSE)

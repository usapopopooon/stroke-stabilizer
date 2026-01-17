<script setup>
import { ref, computed, watch } from 'vue'
import {
  StabilizedPointer,
  noiseFilter,
  kalmanFilter,
  stringFilter,
  gaussianKernel,
} from '@stroke-stabilizer/core'

const canvasRef = ref(null)
const isDrawing = ref(false)
const rawPoints = ref([])
const stabilizedPoints = ref([])
const lastRawPoint = ref(null)
const animationId = ref(null)
const completedStrokes = ref([])

// Filter state
const filterState = ref({
  noise: { enabled: true, minDistance: 2.0 },
  kalman: { enabled: true, strength: 10 },
  string: { enabled: true, stringLength: 8 },
  postProcess: { enabled: true, size: 3 },
})

// Create pointer with current filter settings
function createPointer() {
  const pointer = new StabilizedPointer()

  if (filterState.value.noise.enabled) {
    pointer.addFilter(
      noiseFilter({ minDistance: filterState.value.noise.minDistance })
    )
  }

  if (filterState.value.kalman.enabled) {
    const t = filterState.value.kalman.strength / 100
    pointer.addFilter(
      kalmanFilter({
        processNoise: 1.0 - t * 0.9,
        measurementNoise: 0.05 + t * 0.95,
      })
    )
  }

  if (filterState.value.string.enabled) {
    pointer.addFilter(
      stringFilter({ stringLength: filterState.value.string.stringLength })
    )
  }

  if (filterState.value.postProcess.enabled) {
    pointer.addPostProcess(
      gaussianKernel({ size: filterState.value.postProcess.size })
    )
  }

  return pointer
}

let pointer = createPointer()

// Recreate pointer when filter state changes
watch(
  filterState,
  () => {
    pointer = createPointer()
  },
  { deep: true }
)

function drawLine(ctx, points, color, lineWidth = 2) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
}

function redraw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw completed strokes
  for (const stroke of completedStrokes.value) {
    drawLine(ctx, stroke.raw, 'rgba(255, 100, 100, 0.5)', 1)
    drawLine(ctx, stroke.stabilized, '#4ade80', 2)
  }

  // Draw current stroke
  drawLine(ctx, rawPoints.value, 'rgba(255, 100, 100, 0.5)', 1)
  drawLine(ctx, stabilizedPoints.value, '#4ade80', 2)

  // Draw catch-up line
  if (
    isDrawing.value &&
    lastRawPoint.value &&
    stabilizedPoints.value.length > 0
  ) {
    const lastStabilized =
      stabilizedPoints.value[stabilizedPoints.value.length - 1]
    ctx.beginPath()
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.setLineDash([4, 4])
    ctx.moveTo(lastStabilized.x, lastStabilized.y)
    ctx.lineTo(lastRawPoint.value.x, lastRawPoint.value.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function animationLoop() {
  if (!isDrawing.value) {
    animationId.value = null
    return
  }
  redraw()
  animationId.value = requestAnimationFrame(animationLoop)
}

function handlePointerDown(e) {
  isDrawing.value = true
  e.currentTarget.setPointerCapture(e.pointerId)

  rawPoints.value = []
  stabilizedPoints.value = []
  pointer.reset()

  const point = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  }

  lastRawPoint.value = point
  rawPoints.value.push(point)
  const stabilized = pointer.process(point)
  if (stabilized) {
    stabilizedPoints.value.push(stabilized)
  }

  // Start animation loop
  if (!animationId.value) {
    animationId.value = requestAnimationFrame(animationLoop)
  }
}

function handlePointerMove(e) {
  if (!isDrawing.value) return

  // Use getCoalescedEvents() to get all points between frames
  const coalescedEvents = e.getCoalescedEvents?.() ?? [e]

  for (const ce of coalescedEvents) {
    const point = {
      x: ce.offsetX,
      y: ce.offsetY,
      pressure: ce.pressure,
      timestamp: ce.timeStamp,
    }

    lastRawPoint.value = point
    rawPoints.value.push(point)
    const stabilized = pointer.process(point)
    if (stabilized) {
      stabilizedPoints.value.push(stabilized)
    }
  }
}

function handlePointerUp() {
  if (!isDrawing.value) return
  isDrawing.value = false

  // Cancel animation loop
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }

  // Finish stroke
  const smoothedPoints = pointer.finish()
  lastRawPoint.value = null

  // Save completed stroke
  if (rawPoints.value.length > 0 || smoothedPoints.length > 0) {
    completedStrokes.value.push({
      raw: [...rawPoints.value],
      stabilized: smoothedPoints,
    })
  }

  rawPoints.value = []
  stabilizedPoints.value = []
  redraw()
}

function handlePointerLeave() {
  isDrawing.value = false
  lastRawPoint.value = null
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
}

function handleClear() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  completedStrokes.value = []
  rawPoints.value = []
  stabilizedPoints.value = []
  lastRawPoint.value = null
}
</script>

<template>
  <h1>Stroke Stabilizer Demo (Vue)</h1>
  <div class="controls">
    <button @click="handleClear">Clear Canvas</button>
  </div>
  <div class="filter-controls">
    <div class="filter-item">
      <label>
        <input type="checkbox" v-model="filterState.noise.enabled" />
        Noise
      </label>
      <input
        type="range"
        min="0"
        max="10"
        step="0.5"
        v-model.number="filterState.noise.minDistance"
      />
      <span>{{ filterState.noise.minDistance }}</span>
    </div>
    <div class="filter-item">
      <label>
        <input type="checkbox" v-model="filterState.kalman.enabled" />
        Kalman
      </label>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="filterState.kalman.strength"
      />
      <span>{{ filterState.kalman.strength }}</span>
    </div>
    <div class="filter-item">
      <label>
        <input type="checkbox" v-model="filterState.string.enabled" />
        String
      </label>
      <input
        type="range"
        min="1"
        max="50"
        v-model.number="filterState.string.stringLength"
      />
      <span>{{ filterState.string.stringLength }}</span>
    </div>
    <div class="filter-item">
      <label>
        <input type="checkbox" v-model="filterState.postProcess.enabled" />
        Post-Process
      </label>
      <input
        type="range"
        min="1"
        max="21"
        step="2"
        v-model.number="filterState.postProcess.size"
      />
      <span>{{ filterState.postProcess.size }}</span>
    </div>
  </div>
  <div class="canvas-container">
    <canvas
      ref="canvasRef"
      width="800"
      height="500"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerLeave"
    />
  </div>
  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: rgba(255, 100, 100, 0.5)" />
      <span>Raw input</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #4ade80" />
      <span>Stabilized output</span>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

#app {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1 {
  margin-bottom: 10px;
  font-size: 1.5rem;
}

.controls {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: center;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #4a4a6a;
  color: #eee;
  cursor: pointer;
}

button:hover {
  background: #5a5a7a;
}

.filter-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #2a2a4a;
  border-radius: 4px;
}

.filter-item label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  min-width: 80px;
}

.filter-item input[type='checkbox'] {
  width: 16px;
  height: 16px;
}

.filter-item input[type='range'] {
  width: 80px;
}

.filter-item span {
  min-width: 24px;
  text-align: right;
  font-size: 0.85rem;
  color: #aaa;
}

.canvas-container {
  position: relative;
  border: 2px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

canvas {
  display: block;
  background: #16213e;
  touch-action: none;
}

.legend {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  font-size: 0.9rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 20px;
  height: 3px;
  border-radius: 2px;
}
</style>

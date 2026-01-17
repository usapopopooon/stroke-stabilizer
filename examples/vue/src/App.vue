<script setup>
import { ref, watch } from 'vue'
import {
  useStabilizedPointer,
  useStabilizationLevel,
} from '@stroke-stabilizer/vue'
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

const canvasRef = ref(null)
const isDrawing = ref(false)
const rawPoints = ref([])
const stabilizedPoints = ref([])

const { level, setLevel } = useStabilizationLevel({ initialLevel: 50 })
const { process, reset } = useStabilizedPointer({
  level: level.value,
  onPoint: (point) => {
    stabilizedPoints.value.push(point)
  },
})

// Recreate pointer when level changes
watch(level, () => {
  // The hook will handle the level change internally
})

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
  drawLine(ctx, rawPoints.value, 'rgba(255, 100, 100, 0.5)', 1)
  drawLine(ctx, stabilizedPoints.value, '#4ade80', 2)
}

function handlePointerDown(e) {
  isDrawing.value = true
  e.currentTarget.setPointerCapture(e.pointerId)

  rawPoints.value = []
  stabilizedPoints.value = []
  reset()

  const point = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  }

  rawPoints.value.push(point)
  process(point)
}

function handlePointerMove(e) {
  if (!isDrawing.value) return

  const point = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  }

  rawPoints.value.push(point)
  process(point)
  redraw()
}

function handlePointerUp() {
  if (!isDrawing.value) return
  isDrawing.value = false

  if (stabilizedPoints.value.length > 2) {
    stabilizedPoints.value = smooth(stabilizedPoints.value, {
      kernel: gaussianKernel({ size: 5 }),
      padding: 'reflect',
    })
    redraw()
  }
}

function handleClear() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  rawPoints.value = []
  stabilizedPoints.value = []
}
</script>

<template>
  <h1>Stroke Stabilizer Demo (Vue)</h1>
  <div class="controls">
    <label>
      Stabilization Level:
      <input
        type="range"
        min="0"
        max="100"
        :value="level"
        @input="setLevel(parseInt($event.target.value))"
      />
      <span>{{ level }}</span>
    </label>
    <button @click="handleClear">Clear Canvas</button>
  </div>
  <div class="canvas-container">
    <canvas
      ref="canvasRef"
      width="800"
      height="500"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="isDrawing = false"
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

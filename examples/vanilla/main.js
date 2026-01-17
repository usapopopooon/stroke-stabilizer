import {
  createStabilizedPointer,
  smooth,
  gaussianKernel,
} from '@stroke-stabilizer/core'

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const levelInput = document.getElementById('level')
const levelValue = document.getElementById('levelValue')
const clearButton = document.getElementById('clear')

let pointer = createStabilizedPointer(50)
let isDrawing = false
let rawPoints = []
let stabilizedPoints = []
let lastRawPoint = null
let animationId = null

// Update stabilization level
levelInput.addEventListener('input', (e) => {
  const level = parseInt(e.target.value)
  levelValue.textContent = level
  pointer = createStabilizedPointer(level)
})

// Clear canvas
clearButton.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  rawPoints = []
  stabilizedPoints = []
  lastRawPoint = null
})

// Drawing functions
function drawLine(points, color, lineWidth = 2) {
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
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // Draw raw input (faded red)
  drawLine(rawPoints, 'rgba(255, 100, 100, 0.5)', 1)
  // Draw stabilized output (green)
  drawLine(stabilizedPoints, '#4ade80', 2)

  // Draw catch-up line (blue) from last stabilized point to current raw position
  if (isDrawing && lastRawPoint && stabilizedPoints.length > 0) {
    const lastStabilized = stabilizedPoints[stabilizedPoints.length - 1]
    ctx.beginPath()
    ctx.strokeStyle = '#60a5fa' // blue
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.setLineDash([4, 4])
    ctx.moveTo(lastStabilized.x, lastStabilized.y)
    ctx.lineTo(lastRawPoint.x, lastRawPoint.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function animationLoop() {
  if (!isDrawing) {
    animationId = null
    return
  }
  redraw()
  animationId = requestAnimationFrame(animationLoop)
}

// Pointer events
canvas.addEventListener('pointerdown', (e) => {
  isDrawing = true
  canvas.setPointerCapture(e.pointerId)

  rawPoints = []
  stabilizedPoints = []
  pointer.reset()

  const point = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  }

  lastRawPoint = point
  rawPoints.push(point)
  const stabilized = pointer.process(point)
  if (stabilized) {
    stabilizedPoints.push(stabilized)
  }

  // Start animation loop
  if (!animationId) {
    animationId = requestAnimationFrame(animationLoop)
  }
})

canvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return

  const point = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  }

  lastRawPoint = point
  rawPoints.push(point)
  const stabilized = pointer.process(point)
  if (stabilized) {
    stabilizedPoints.push(stabilized)
  }
})

canvas.addEventListener('pointerup', () => {
  if (!isDrawing) return
  isDrawing = false
  lastRawPoint = null

  // Cancel animation loop
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Apply post-processing smoothing
  if (stabilizedPoints.length > 2) {
    stabilizedPoints = smooth(stabilizedPoints, {
      kernel: gaussianKernel({ size: 5 }),
      padding: 'reflect',
    })
    redraw()
  }
})

canvas.addEventListener('pointerleave', () => {
  isDrawing = false
  lastRawPoint = null
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

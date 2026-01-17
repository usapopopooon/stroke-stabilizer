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

  rawPoints.push(point)
  const stabilized = pointer.process(point)
  if (stabilized) {
    stabilizedPoints.push(stabilized)
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

  rawPoints.push(point)
  const stabilized = pointer.process(point)
  if (stabilized) {
    stabilizedPoints.push(stabilized)
  }

  redraw()
})

canvas.addEventListener('pointerup', () => {
  if (!isDrawing) return
  isDrawing = false

  // Finish stroke and apply post-processing smoothing
  const finishedPoints = pointer.finish()

  if (finishedPoints.length > 2) {
    stabilizedPoints = smooth(finishedPoints, {
      kernel: gaussianKernel({ size: 5 }),
    })
    redraw()
  }
})

canvas.addEventListener('pointerleave', () => {
  isDrawing = false
})

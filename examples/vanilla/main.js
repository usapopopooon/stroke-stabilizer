import {
  StabilizedPointer,
  noiseFilter,
  kalmanFilter,
  stringFilter,
  smooth,
  gaussianKernel,
} from '@stroke-stabilizer/core'

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const levelInput = document.getElementById('level')
const levelValue = document.getElementById('levelValue')
const clearButton = document.getElementById('clear')

// Create custom pointer with filters
function createPointer(level) {
  const pointer = new StabilizedPointer()
  if (level === 0) return pointer

  const t = Math.min(level / 50, 1.0)

  // Noise filter
  pointer.addFilter(noiseFilter({ minDistance: 1.0 + t * 2.0 }))

  if (level >= 21) {
    // Kalman filter (very light)
    pointer.addFilter(
      kalmanFilter({
        processNoise: 1.0 - t * 0.3,
        measurementNoise: 0.1 + t * 0.15,
      })
    )

    // String filter
    pointer.addFilter(stringFilter({ stringLength: Math.round(5 + t * 15) }))
  }

  return pointer
}

let pointer = createPointer(50)
let isDrawing = false
let rawPoints = []
let stabilizedPoints = []
let lastRawPoint = null
let animationId = null

// Store completed strokes
let completedStrokes = []

// Update stabilization level
levelInput.addEventListener('input', (e) => {
  const level = parseInt(e.target.value)
  levelValue.textContent = level
  pointer = createPointer(level)
})

// Clear canvas
clearButton.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  completedStrokes = []
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

  // Draw completed strokes
  for (const stroke of completedStrokes) {
    drawLine(stroke.raw, 'rgba(255, 100, 100, 0.5)', 1)
    drawLine(stroke.stabilized, '#4ade80', 2)
  }

  // Draw current stroke
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

  // Cancel animation loop
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Append endpoint to ensure stroke ends at actual input point
  if (lastRawPoint && stabilizedPoints.length > 0) {
    const lastStabilized = stabilizedPoints[stabilizedPoints.length - 1]
    const dx = lastRawPoint.x - lastStabilized.x
    const dy = lastRawPoint.y - lastStabilized.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance >= 1) {
      stabilizedPoints.push({
        x: lastRawPoint.x,
        y: lastRawPoint.y,
        pressure: lastRawPoint.pressure ?? 1,
        timestamp: lastRawPoint.timestamp + 8,
      })
    }
  }

  lastRawPoint = null

  // Apply light post-processing to round corners
  let smoothedPoints = stabilizedPoints
  if (stabilizedPoints.length > 2) {
    smoothedPoints = smooth(stabilizedPoints, {
      kernel: gaussianKernel({ size: 3 }),
    })
  }

  // Save completed stroke
  if (rawPoints.length > 0 || smoothedPoints.length > 0) {
    completedStrokes.push({
      raw: [...rawPoints],
      stabilized: [...smoothedPoints],
    })
  }

  rawPoints = []
  stabilizedPoints = []
  redraw()
})

canvas.addEventListener('pointerleave', () => {
  isDrawing = false
  lastRawPoint = null
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

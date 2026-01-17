import {
  StabilizedPointer,
  noiseFilter,
  kalmanFilter,
  stringFilter,
  gaussianKernel,
} from '@stroke-stabilizer/core'

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const clearButton = document.getElementById('clear')

// Filter checkboxes
const filterNoiseCheckbox = document.getElementById('filterNoise')
const filterKalmanCheckbox = document.getElementById('filterKalman')
const filterStringCheckbox = document.getElementById('filterString')
const filterPostProcessCheckbox = document.getElementById('filterPostProcess')

// Filter strength sliders
const noiseStrengthInput = document.getElementById('noiseStrength')
const kalmanStrengthInput = document.getElementById('kalmanStrength')
const stringStrengthInput = document.getElementById('stringStrength')
const postProcessStrengthInput = document.getElementById('postProcessStrength')

// Filter value displays
const noiseValueDisplay = document.getElementById('noiseValue')
const kalmanValueDisplay = document.getElementById('kalmanValue')
const stringValueDisplay = document.getElementById('stringValue')
const postProcessValueDisplay = document.getElementById('postProcessValue')

// Filter state
const filterState = {
  noise: { enabled: true, minDistance: 2.0 },
  kalman: { enabled: true, strength: 20 },
  string: { enabled: true, stringLength: 15 },
  postProcess: { enabled: true, size: 1 },
}

// Create pointer with current filter settings
function createPointer() {
  const pointer = new StabilizedPointer()

  if (filterState.noise.enabled) {
    pointer.addFilter(
      noiseFilter({ minDistance: filterState.noise.minDistance })
    )
  }

  if (filterState.kalman.enabled) {
    // strength 0-100 maps to processNoise 1.0-0.1, measurementNoise 0.05-1.0
    const t = filterState.kalman.strength / 100
    pointer.addFilter(
      kalmanFilter({
        processNoise: 1.0 - t * 0.9,
        measurementNoise: 0.05 + t * 0.95,
      })
    )
  }

  if (filterState.string.enabled) {
    pointer.addFilter(
      stringFilter({ stringLength: filterState.string.stringLength })
    )
  }

  if (filterState.postProcess.enabled) {
    pointer.addPostProcess(
      gaussianKernel({ size: filterState.postProcess.size })
    )
  }

  return pointer
}

let pointer = createPointer()
let isDrawing = false
let rawPoints = []
let stabilizedPoints = []
let lastRawPoint = null
let animationId = null

// Store completed strokes
let completedStrokes = []

// Filter checkbox event listeners
filterNoiseCheckbox.addEventListener('change', (e) => {
  filterState.noise.enabled = e.target.checked
  pointer = createPointer()
})

filterKalmanCheckbox.addEventListener('change', (e) => {
  filterState.kalman.enabled = e.target.checked
  pointer = createPointer()
})

filterStringCheckbox.addEventListener('change', (e) => {
  filterState.string.enabled = e.target.checked
  pointer = createPointer()
})

filterPostProcessCheckbox.addEventListener('change', (e) => {
  filterState.postProcess.enabled = e.target.checked
  pointer = createPointer()
})

// Filter strength slider event listeners
noiseStrengthInput.addEventListener('input', (e) => {
  filterState.noise.minDistance = parseFloat(e.target.value)
  noiseValueDisplay.textContent = e.target.value
  pointer = createPointer()
})

kalmanStrengthInput.addEventListener('input', (e) => {
  filterState.kalman.strength = parseInt(e.target.value)
  kalmanValueDisplay.textContent = e.target.value
  pointer = createPointer()
})

stringStrengthInput.addEventListener('input', (e) => {
  filterState.string.stringLength = parseInt(e.target.value)
  stringValueDisplay.textContent = e.target.value
  pointer = createPointer()
})

postProcessStrengthInput.addEventListener('input', (e) => {
  filterState.postProcess.size = parseInt(e.target.value)
  postProcessValueDisplay.textContent = e.target.value
  pointer = createPointer()
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

  // Finish stroke (automatically appends endpoint and applies post-processing)
  const smoothedPoints = pointer.finish()

  lastRawPoint = null

  // Save completed stroke
  if (rawPoints.length > 0 || smoothedPoints.length > 0) {
    completedStrokes.push({
      raw: [...rawPoints],
      stabilized: smoothedPoints,
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

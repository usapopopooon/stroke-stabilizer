import { useRef, useState, useCallback, useMemo } from 'react'
import {
  StabilizedPointer,
  noiseFilter,
  kalmanFilter,
  stringFilter,
  gaussianKernel,
} from '@stroke-stabilizer/core'

export default function App() {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [rawPoints, setRawPoints] = useState([])
  const [stabilizedPoints, setStabilizedPoints] = useState([])
  const lastRawPointRef = useRef(null)
  const animationIdRef = useRef(null)
  const [completedStrokes, setCompletedStrokes] = useState([])

  // Filter state
  const [filterState, setFilterState] = useState({
    noise: { enabled: true, minDistance: 2.0 },
    kalman: { enabled: true, strength: 20 },
    string: { enabled: true, stringLength: 15 },
    postProcess: { enabled: true, size: 1 },
  })

  // Create pointer with current filter settings
  const pointerRef = useRef(null)

  const createPointer = useCallback(() => {
    const pointer = new StabilizedPointer()

    if (filterState.noise.enabled) {
      pointer.addFilter(
        noiseFilter({ minDistance: filterState.noise.minDistance })
      )
    }

    if (filterState.kalman.enabled) {
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
  }, [filterState])

  // Update pointer when filter state changes
  useMemo(() => {
    pointerRef.current = createPointer()
  }, [createPointer])

  const drawLine = useCallback((ctx, points, color, lineWidth = 2) => {
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
  }, [])

  const redraw = useCallback(
    (raw, stabilized, strokes, drawing, lastRaw) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw completed strokes
      for (const stroke of strokes) {
        drawLine(ctx, stroke.raw, 'rgba(255, 100, 100, 0.5)', 1)
        drawLine(ctx, stroke.stabilized, '#4ade80', 2)
      }

      // Draw current stroke
      drawLine(ctx, raw, 'rgba(255, 100, 100, 0.5)', 1)
      drawLine(ctx, stabilized, '#4ade80', 2)

      // Draw catch-up line
      if (drawing && lastRaw && stabilized.length > 0) {
        const lastStabilized = stabilized[stabilized.length - 1]
        ctx.beginPath()
        ctx.strokeStyle = '#60a5fa'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.setLineDash([4, 4])
        ctx.moveTo(lastStabilized.x, lastStabilized.y)
        ctx.lineTo(lastRaw.x, lastRaw.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    },
    [drawLine]
  )

  const handlePointerDown = (e) => {
    setIsDrawing(true)
    e.currentTarget.setPointerCapture(e.pointerId)

    setRawPoints([])
    setStabilizedPoints([])
    pointerRef.current.reset()

    const point = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    }

    lastRawPointRef.current = point
    setRawPoints([point])
    const stabilized = pointerRef.current.process(point)
    if (stabilized) {
      setStabilizedPoints([stabilized])
    }

    // Start animation loop
    const animate = () => {
      setRawPoints((raw) => {
        setStabilizedPoints((stab) => {
          setCompletedStrokes((strokes) => {
            redraw(raw, stab, strokes, true, lastRawPointRef.current)
            return strokes
          })
          return stab
        })
        return raw
      })
      animationIdRef.current = requestAnimationFrame(animate)
    }
    animationIdRef.current = requestAnimationFrame(animate)
  }

  const handlePointerMove = (e) => {
    if (!isDrawing) return

    const point = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    }

    lastRawPointRef.current = point
    setRawPoints((prev) => [...prev, point])
    const stabilized = pointerRef.current.process(point)
    if (stabilized) {
      setStabilizedPoints((prev) => [...prev, stabilized])
    }
  }

  const handlePointerUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    // Cancel animation loop
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }

    // Finish stroke
    const smoothedPoints = pointerRef.current.finish()
    lastRawPointRef.current = null

    setRawPoints((raw) => {
      if (raw.length > 0 || smoothedPoints.length > 0) {
        setCompletedStrokes((prev) => [
          ...prev,
          { raw: [...raw], stabilized: smoothedPoints },
        ])
      }
      return []
    })
    setStabilizedPoints([])

    // Final redraw
    setCompletedStrokes((strokes) => {
      redraw([], [], strokes, false, null)
      return strokes
    })
  }

  const handlePointerLeave = () => {
    setIsDrawing(false)
    lastRawPointRef.current = null
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setCompletedStrokes([])
    setRawPoints([])
    setStabilizedPoints([])
    lastRawPointRef.current = null
  }

  const updateFilter = (filterName, key, value) => {
    setFilterState((prev) => ({
      ...prev,
      [filterName]: { ...prev[filterName], [key]: value },
    }))
  }

  return (
    <>
      <h1>Stroke Stabilizer Demo (React)</h1>
      <div className="controls">
        <button onClick={handleClear}>Clear Canvas</button>
      </div>
      <div className="filter-controls">
        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={filterState.noise.enabled}
              onChange={(e) =>
                updateFilter('noise', 'enabled', e.target.checked)
              }
            />
            Noise
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={filterState.noise.minDistance}
            onChange={(e) =>
              updateFilter('noise', 'minDistance', parseFloat(e.target.value))
            }
          />
          <span>{filterState.noise.minDistance}</span>
        </div>
        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={filterState.kalman.enabled}
              onChange={(e) =>
                updateFilter('kalman', 'enabled', e.target.checked)
              }
            />
            Kalman
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={filterState.kalman.strength}
            onChange={(e) =>
              updateFilter('kalman', 'strength', parseInt(e.target.value))
            }
          />
          <span>{filterState.kalman.strength}</span>
        </div>
        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={filterState.string.enabled}
              onChange={(e) =>
                updateFilter('string', 'enabled', e.target.checked)
              }
            />
            String
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={filterState.string.stringLength}
            onChange={(e) =>
              updateFilter('string', 'stringLength', parseInt(e.target.value))
            }
          />
          <span>{filterState.string.stringLength}</span>
        </div>
        <div className="filter-item">
          <label>
            <input
              type="checkbox"
              checked={filterState.postProcess.enabled}
              onChange={(e) =>
                updateFilter('postProcess', 'enabled', e.target.checked)
              }
            />
            Post-Process
          </label>
          <input
            type="range"
            min="1"
            max="9"
            step="2"
            value={filterState.postProcess.size}
            onChange={(e) =>
              updateFilter('postProcess', 'size', parseInt(e.target.value))
            }
          />
          <span>{filterState.postProcess.size}</span>
        </div>
      </div>
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
      </div>
      <div className="legend">
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ background: 'rgba(255,100,100,0.5)' }}
          />
          <span>Raw input</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#4ade80' }} />
          <span>Stabilized output</span>
        </div>
      </div>
    </>
  )
}

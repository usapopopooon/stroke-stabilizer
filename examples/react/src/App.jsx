import { useRef, useState, useCallback } from 'react'
import {
  useStabilizedPointer,
  useStabilizationLevel,
} from '@stroke-stabilizer/react'
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

export default function App() {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [rawPoints, setRawPoints] = useState([])
  const [stabilizedPoints, setStabilizedPoints] = useState([])

  const { level, setLevel } = useStabilizationLevel({ initialLevel: 50 })
  const { process, reset } = useStabilizedPointer({
    level,
    onPoint: (point) => {
      setStabilizedPoints((prev) => [...prev, point])
    },
  })

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
    (raw, stabilized) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawLine(ctx, raw, 'rgba(255, 100, 100, 0.5)', 1)
      drawLine(ctx, stabilized, '#4ade80', 2)
    },
    [drawLine]
  )

  const handlePointerDown = (e) => {
    setIsDrawing(true)
    e.currentTarget.setPointerCapture(e.pointerId)

    setRawPoints([])
    setStabilizedPoints([])
    reset()

    const point = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    }

    setRawPoints([point])
    process(point)
  }

  const handlePointerMove = (e) => {
    if (!isDrawing) return

    const point = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    }

    setRawPoints((prev) => {
      const newRaw = [...prev, point]
      setStabilizedPoints((prevStabilized) => {
        redraw(newRaw, prevStabilized)
        return prevStabilized
      })
      return newRaw
    })

    process(point)
  }

  const handlePointerUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    setStabilizedPoints((prev) => {
      if (prev.length > 2) {
        const smoothed = smooth(prev, {
          kernel: gaussianKernel({ size: 5 }),
          padding: 'reflect',
        })
        setRawPoints((rawPrev) => {
          redraw(rawPrev, smoothed)
          return rawPrev
        })
        return smoothed
      }
      return prev
    })
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setRawPoints([])
    setStabilizedPoints([])
  }

  return (
    <>
      <h1>Stroke Stabilizer Demo (React)</h1>
      <div className="controls">
        <label>
          Stabilization Level:
          <input
            type="range"
            min="0"
            max="100"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value))}
          />
          <span>{level}</span>
        </label>
        <button onClick={handleClear}>Clear Canvas</button>
      </div>
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setIsDrawing(false)}
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

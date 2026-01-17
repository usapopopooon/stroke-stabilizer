# @stroke-stabilizer/react

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react)

[English](../README.md)

> これは [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部です

デジタルドローイングアプリケーション向けのストローク手ぶれ補正用 React hooks です。

## インストール

```bash
npm install @stroke-stabilizer/react @stroke-stabilizer/core
```

## 使用方法

### useStabilizedPointer

```tsx
import { useStabilizedPointer } from '@stroke-stabilizer/react'
import { oneEuroFilter } from '@stroke-stabilizer/core'

function DrawingCanvas() {
  const { process, reset, pointer } = useStabilizedPointer({
    level: 50,
    onPoint: (point) => {
      draw(point.x, point.y)
    },
  })

  const handlePointerMove = (e: React.PointerEvent) => {
    process({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    })
  }

  const handlePointerUp = () => {
    reset()
  }

  return (
    <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
  )
}
```

### rAF バッチ処理

高頻度入力デバイス向けに、`StabilizedPointer` のバッチ処理を使用できます：

```tsx
import { useStabilizedPointer } from '@stroke-stabilizer/react'
import { useEffect } from 'react'

function DrawingCanvas() {
  const { pointer } = useStabilizedPointer({ level: 50 })

  useEffect(() => {
    pointer.enableBatching({
      onBatch: (points) => drawPoints(points),
    })
    return () => pointer.disableBatching()
  }, [pointer])

  const handlePointerMove = (e: React.PointerEvent) => {
    pointer.queue({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure,
      timestamp: e.timeStamp,
    })
  }

  return <canvas onPointerMove={handlePointerMove} />
}
```

### useStabilizationLevel

安定化レベルの状態管理用フックです。

```tsx
import { useStabilizationLevel } from '@stroke-stabilizer/react'

function StabilizationSlider() {
  const { level, setLevel, isEnabled } = useStabilizationLevel({
    initialLevel: 50,
  })

  return (
    <div>
      <input
        type="range"
        min={0}
        max={100}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value))}
      />
      <span>{level}%</span>
      {isEnabled && <span>手ぶれ補正有効</span>}
    </div>
  )
}
```

## API

### useStabilizedPointer(options?)

安定化ポインターインスタンスを作成します。

**オプション：**

- `level` - 安定化レベル（0-100）。指定時はプリセットを使用
- `filters` - カスタムフィルター配列。level 未指定時に使用
- `onPoint` - 点が処理されたときのコールバック

**戻り値：**

- `process(point)` - 単一の点を処理
- `processAll(points)` - 複数の点を処理
- `flushBuffer()` - 内部バッファをフラッシュ
- `reset()` - ポインター状態をリセット
- `addFilter(filter)` - フィルターを動的に追加
- `removeFilter(type)` - タイプでフィルターを削除
- `updateFilter(type, params)` - フィルターパラメータを更新
- `pointer` - StabilizedPointer インスタンスへの参照

### useStabilizationLevel(options?)

安定化レベルの状態を管理します。

**オプション：**

- `initialLevel` - 初期レベル（デフォルト: 0）
- `min` - 最小レベル（デフォルト: 0）
- `max` - 最大レベル（デフォルト: 100）
- `onChange` - レベル変更時のコールバック

**戻り値：**

- `level` - 現在のレベル
- `setLevel(value)` - レベルを設定
- `increase(amount?)` - レベルを増加（デフォルト: 10）
- `decrease(amount?)` - レベルを減少（デフォルト: 10）
- `isEnabled` - 安定化が有効かどうか（level > 0）

## ライセンス

[MIT](../../LICENSE)

# @stroke-stabilizer/react

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react)

[English](../README.md)

> [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部

お絵描きアプリ向けのReact用の手ぶれ補正ライブラリです。

**[デモ](https://usapopopooon.github.io/stroke-stabilizer/react/)**

## インストール

```bash
npm install @stroke-stabilizer/react @stroke-stabilizer/core
```

## 使い方

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
    // 重要: getCoalescedEvents() で滑らかな入力を取得
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]

    for (const ce of events) {
      process({
        x: ce.offsetX,
        y: ce.offsetY,
        pressure: ce.pressure,
        timestamp: ce.timeStamp,
      })
    }
  }

  const handlePointerUp = () => {
    // 後処理済みの最終ポイントを取得
    const finalPoints = pointer.finish()
    drawFinalStroke(finalPoints)
  }

  return (
    <canvas onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
  )
}
```

> **重要:** `getCoalescedEvents()` を必ず使用してください。これを使わないとブラウザがイベントを間引くため、カクカクした線になります。

### rAFバッチ処理

ペンタブレットなど高頻度入力向けに、バッチ処理が使えます。

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
    // 重要: getCoalescedEvents() で滑らかな入力を取得
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]

    for (const ce of events) {
      pointer.queue({
        x: ce.offsetX,
        y: ce.offsetY,
        pressure: ce.pressure,
        timestamp: ce.timeStamp,
      })
    }
  }

  return <canvas onPointerMove={handlePointerMove} />
}
```

### useStabilizationLevel

補正レベルの状態管理用。

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
      {isEnabled && <span>手ぶれ補正ON</span>}
    </div>
  )
}
```

## API

### useStabilizedPointer(options?)

ポインタインスタンスを作成。

**オプション：**

- `level` - 補正レベル（0-100）。指定するとプリセットを使用
- `filters` - カスタムフィルタ配列。levelがない場合に使用
- `onPoint` - 点が処理されたときのコールバック

**戻り値：**

- `process(point)` - 1点を処理
- `processAll(points)` - 複数点を処理
- `flushBuffer()` - 内部バッファをフラッシュ
- `finish()` - 後処理して最終ポイントを返す（終点も自動追加）
- `reset()` - ポインタをリセット
- `addFilter(filter)` - フィルタを追加
- `removeFilter(type)` - フィルタを削除
- `updateFilter(type, params)` - フィルタのパラメータを更新
- `pointer` - StabilizedPointerインスタンス

### useStabilizationLevel(options?)

補正レベルの状態管理。

**オプション：**

- `initialLevel` - 初期値（デフォルト: 0）
- `min` - 最小値（デフォルト: 0）
- `max` - 最大値（デフォルト: 100）
- `onChange` - 変更時のコールバック

**戻り値：**

- `level` - 現在のレベル
- `setLevel(value)` - レベルを設定
- `increase(amount?)` - 増やす（デフォルト: 10）
- `decrease(amount?)` - 減らす（デフォルト: 10）
- `isEnabled` - 有効かどうか（level > 0）

## ライセンス

[MIT](../../LICENSE)

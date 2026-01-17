# @stroke-stabilizer/vue

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)

[English](../README.md)

> これは [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部です

デジタルドローイングアプリケーション向けのストローク手ぶれ補正用 Vue composables です。

## インストール

```bash
npm install @stroke-stabilizer/vue @stroke-stabilizer/core
```

## 使用方法

### useStabilizedPointer

```vue
<script setup lang="ts">
import { useStabilizedPointer } from '@stroke-stabilizer/vue'

const { process, reset, pointer } = useStabilizedPointer({
  level: 50,
  onPoint: (point) => {
    draw(point.x, point.y)
  },
})

function handlePointerMove(e: PointerEvent) {
  process({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
}

function handlePointerUp() {
  reset()
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" @pointerup="handlePointerUp" />
</template>
```

### rAF バッチ処理

高頻度入力デバイス向けに、`StabilizedPointer` のバッチ処理を使用できます：

```vue
<script setup lang="ts">
import { useStabilizedPointer } from '@stroke-stabilizer/vue'
import { onMounted, onUnmounted } from 'vue'

const { pointer } = useStabilizedPointer({ level: 50 })

onMounted(() => {
  pointer.value.enableBatching({
    onBatch: (points) => drawPoints(points),
  })
})

onUnmounted(() => {
  pointer.value.disableBatching()
})

function handlePointerMove(e: PointerEvent) {
  pointer.value.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" />
</template>
```

### useStabilizationLevel

リアクティブな状態で安定化レベルを管理するコンポーザブルです。

```vue
<script setup lang="ts">
import {
  useStabilizationLevel,
  useStabilizedPointer,
} from '@stroke-stabilizer/vue'

const { level, setLevel, isEnabled } = useStabilizationLevel({
  initialLevel: 50,
  onChange: (newLevel) => console.log('レベル変更:', newLevel),
})

const { process, reset } = useStabilizedPointer({
  level: level.value,
})
</script>

<template>
  <div>
    <input
      type="range"
      :min="0"
      :max="100"
      :value="level"
      @input="setLevel(Number(($event.target as HTMLInputElement).value))"
    />
    <span>{{ level }}%</span>
    <span v-if="isEnabled">手ぶれ補正有効</span>
  </div>
</template>
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
- `pointer` - StabilizedPointer インスタンスへの computed ref
- `filterCount` - アクティブなフィルター数への computed ref

### useStabilizationLevel(options?)

安定化レベルの状態を管理します。

**オプション：**

- `initialLevel` - 初期レベル（デフォルト: 0）
- `min` - 最小レベル（デフォルト: 0）
- `max` - 最大レベル（デフォルト: 100）
- `onChange` - レベル変更時のコールバック

**戻り値：**

- `level` - 現在のレベルへの computed ref
- `setLevel(value)` - レベルを設定
- `increase(amount?)` - レベルを増加（デフォルト: 10）
- `decrease(amount?)` - レベルを減少（デフォルト: 10）
- `isEnabled` - 安定化が有効かどうかを示す computed ref（level > 0）

## ライセンス

[MIT](../../LICENSE)

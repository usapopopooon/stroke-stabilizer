# @stroke-stabilizer/vue

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)

[English](../README.md)

> [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部

お絵描きアプリ向けのVue用の手ぶれ補正ライブラリです。

**[デモ](https://usapopopooon.github.io/stroke-stabilizer/vue/)**

## インストール

```bash
npm install @stroke-stabilizer/vue @stroke-stabilizer/core
```

## 使い方

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
  // 後処理済みの最終ポイントを取得
  const finalPoints = pointer.value.finish()
  drawFinalStroke(finalPoints)
}
</script>

<template>
  <canvas @pointermove="handlePointerMove" @pointerup="handlePointerUp" />
</template>
```

### rAFバッチ処理

ペンタブレットなど高頻度入力向けに、バッチ処理が使えます。

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

補正レベルの状態管理用。

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
    <span v-if="isEnabled">手ぶれ補正ON</span>
  </div>
</template>
```

## API

### useStabilizedPointer(options?)

ポインタインスタンスを作る。

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
- `pointer` - StabilizedPointerのcomputed ref
- `filterCount` - フィルタ数のcomputed ref

### useStabilizationLevel(options?)

補正レベルの状態管理。

**オプション：**

- `initialLevel` - 初期値（デフォルト: 0）
- `min` - 最小値（デフォルト: 0）
- `max` - 最大値（デフォルト: 100）
- `onChange` - 変更時のコールバック

**戻り値：**

- `level` - 現在のレベルのcomputed ref
- `setLevel(value)` - レベルを設定
- `increase(amount?)` - 増やす（デフォルト: 10）
- `decrease(amount?)` - 減らす（デフォルト: 10）
- `isEnabled` - 有効かどうかのcomputed ref（level > 0）

## ライセンス

[MIT](../../LICENSE)

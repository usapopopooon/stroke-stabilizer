# @stroke-stabilizer/core

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)

[English](../README.md)

> [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部

お絵描きアプリ向けの軽量な手ぶれ補正ライブラリです。フレームワーク非依存。

**[デモ](https://usapopopooon.github.io/stroke-stabilizer/)**

ペンやマウスの入力をリアルタイムでスムーズにし、手の震えを軽減します。

## 特徴

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - フィルタを実行時に追加・削除・更新できる
- **二層処理** - リアルタイムフィルタ＋後処理の畳み込み
- **終点補正** - ストロークが入力位置で終わる
- **rAFバッチ処理** - ポインタイベントをフレーム単位にまとめてCPU負荷を軽減
- **8種類のフィルタ** - 移動平均からOne Euro Filterまで
- **エッジ保存** - バイラテラルカーネルで角を潰さずスムーズに
- **TypeScript対応** - 型定義付き
- **依存なし** - Pure JavaScript

## インストール

```bash
npm install @stroke-stabilizer/core
```

## クイックスタート

```ts
import {
  StabilizedPointer,
  emaFilter,
  oneEuroFilter,
} from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(emaFilter({ alpha: 0.5 }))
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))

canvas.addEventListener('pointermove', (e) => {
  const result = pointer.process({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })

  if (result) {
    draw(result.x, result.y)
  }
})

canvas.addEventListener('pointerup', () => {
  pointer.reset()
})
```

## フィルタ

> **📖 [フィルタリファレンス](../../../docs/filters.ja.md)** - 数式や詳しい説明

### リアルタイムフィルタ

| フィルタ                 | 説明                | 用途                         |
| ------------------------ | ------------------- | ---------------------------- |
| `noiseFilter`            | 近い点を無視        | ジッター除去                 |
| `movingAverageFilter`    | 単純移動平均（FIR） | 基本的なスムージング         |
| `emaFilter`              | 指数移動平均（IIR） | 低遅延スムージング           |
| `kalmanFilter`           | カルマンフィルタ    | ノイズの多い入力向け         |
| `stringFilter`           | Lazy Brush          | 遅延のある滑らかなストローク |
| `oneEuroFilter`          | 速度適応型ローパス  | 滑らかさと遅延のバランス     |
| `linearPredictionFilter` | 次の位置を予測      | ラグ補正                     |

### 後処理カーネル

| カーネル          | 説明                         |
| ----------------- | ---------------------------- |
| `gaussianKernel`  | ガウシアンブラー             |
| `boxKernel`       | 単純平均                     |
| `triangleKernel`  | 線形フォールオフ             |
| `bilateralKernel` | エッジを保存するスムージング |

## 使用例

### 基本的なリアルタイム処理

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer().addFilter(
  oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
)

// 1点ずつ処理
const smoothed = pointer.process({ x, y, timestamp })
```

### フィルタの動的更新

```ts
// フィルタ追加
pointer.addFilter(emaFilter({ alpha: 0.3 }))

// パラメータ更新
pointer.updateFilter('ema', { alpha: 0.5 })

// フィルタ削除
pointer.removeFilter('ema')
```

### 後処理（双方向畳み込み）

```ts
import { StabilizedPointer, gaussianKernel } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .addPostProcess(gaussianKernel({ size: 7 }), { padding: 'reflect' })

// リアルタイムで点を処理
pointer.process(point)

// ストローク終了後、後処理を適用
const finalPoints = pointer.finish()
```

### 後処理のプレビュー

`finishWithoutReset()` を使用すると、バッファを消さずに違う設定でプレビューできます。

```ts
import {
  StabilizedPointer,
  gaussianKernel,
  bilateralKernel,
} from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()

// 点を処理
pointer.process(point1)
pointer.process(point2)
pointer.process(point3)

// ガウシアンでプレビュー
pointer.addPostProcess(gaussianKernel({ size: 5 }))
const preview1 = pointer.finishWithoutReset()
draw(preview1)

// バイラテラルに変えてプレビュー
pointer.removePostProcess('gaussian')
pointer.addPostProcess(bilateralKernel({ size: 7, sigmaValue: 10 }))
const preview2 = pointer.finishWithoutReset()
draw(preview2)

// 確定（バッファをリセット）
const final = pointer.finish()
```

**`finishWithoutReset()` と `finish()` の違い：**

| メソッド               | 後処理 | バッファリセット |
| ---------------------- | ------ | ---------------- |
| `finishWithoutReset()` | ✅     | ❌               |
| `finish()`             | ✅     | ✅               |

### エッジ保存スムージング

```ts
import { smooth, bilateralKernel } from '@stroke-stabilizer/core'

// 角を潰さずにスムーズ化
const smoothed = smooth(points, {
  kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
  padding: 'reflect',
})
```

### 終点補正

`finish()` はデフォルトで最後の生の点を追加し、ストロークが入力位置で終わるようにします。

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

// デフォルト：終点補正あり（推奨）
const pointer = new StabilizedPointer()
pointer.addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))

pointer.process(point1)
pointer.process(point2)

// finish() で最後の生の点が自動追加される
const finalPoints = pointer.finish()

// 無効にする場合
const pointerNoEndpoint = new StabilizedPointer({ appendEndpoint: false })
```

### smooth() での終点保存

`smooth()` はデフォルトで始点と終点を保存します。

```ts
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

// デフォルト：終点保存（推奨）
const smoothed = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
})

// 無効にする場合
const smoothedAll = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
  preserveEndpoints: false,
})
```

### rAFバッチ処理

ペンタブレットなど高頻度入力向けに、ポインタイベントをアニメーションフレームにまとめてCPU負荷を減らせます。

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .enableBatching({
    onBatch: (points) => {
      // フレームごとに1回、まとめて処理済みの点が来る
      drawPoints(points)
    },
    onPoint: (point) => {
      // 各点ごとに呼ばれる（オプション）
      updatePreview(point)
    },
  })

canvas.addEventListener('pointermove', (e) => {
  // キューに入れて、次のフレームでまとめて処理
  pointer.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
})

canvas.addEventListener('pointerup', () => {
  // 溜まった点をフラッシュして後処理
  const finalPoints = pointer.finish()
})
```

**バッチ処理メソッド：**

```ts
// バッチ処理の有効/無効
pointer.enableBatching({ onBatch, onPoint })
pointer.disableBatching()

// キューに追加
pointer.queue(point)
pointer.queueAll(points)

// 即座に処理
pointer.flushBatch()

// 状態確認
pointer.isBatchingEnabled // boolean
pointer.pendingCount // キュー内の点の数
```

### プリセット

```ts
import { createFromPreset } from '@stroke-stabilizer/core'

// 用意された設定で簡単セットアップ
const pointer = createFromPreset('smooth') // 強めのスムージング
const pointer = createFromPreset('responsive') // 低遅延
const pointer = createFromPreset('balanced') // バランス型
```

## フィルタパラメータ

### oneEuroFilter（おすすめ）

```ts
oneEuroFilter({
  minCutoff: 1.0, // 低速時のスムージング（小さいほど滑らか）
  beta: 0.007, // 速度適応（大きいほど応答性アップ）
  dCutoff: 1.0, // 微分カットオフ（普通は1.0）
})
```

### emaFilter

```ts
emaFilter({
  alpha: 0.5, // 0-1、大きいほど応答性アップ
})
```

### kalmanFilter

```ts
kalmanFilter({
  processNoise: 0.1, // 動きの予測分散
  measurementNoise: 0.5, // 入力ノイズ
})
```

### linearPredictionFilter

```ts
linearPredictionFilter({
  historySize: 4, // 予測に使用する点数
  predictionFactor: 0.5, // 予測の強さ（0-1）
  smoothing: 0.6, // 出力のスムージング
})
```

### stringFilter（Lazy Brush）

```ts
stringFilter({
  stringLength: 10, // アンカーが動き出すまでの距離
})
```

### bilateralKernel

```ts
bilateralKernel({
  size: 7, // カーネルサイズ（奇数）
  sigmaValue: 10, // エッジ保存（小さいほど角が残る）
  sigmaSpace: 2, // 空間フォールオフ（オプション）
})
```

## APIリファレンス

### StabilizedPointer

```ts
class StabilizedPointer {
  // コンストラクタ
  constructor(options?: StabilizedPointerOptions)

  // フィルタ管理
  addFilter(filter: Filter): this
  removeFilter(type: string): boolean
  updateFilter<T>(type: string, params: Partial<T>): boolean
  getFilter(type: string): Filter | undefined

  // 後処理
  addPostProcess(kernel: Kernel, options?: { padding?: PaddingMode }): this
  removePostProcess(type: string): boolean

  // 処理
  process(point: PointerPoint): PointerPoint | null
  finish(): Point[] // 後処理してリセット
  finishWithoutReset(): Point[] // リセットなしで後処理（プレビュー用）
  reset(): void // フィルタリセット、バッファクリア

  // バッチ処理（rAF）
  enableBatching(config?: BatchConfig): this
  disableBatching(): this
  queue(point: PointerPoint): this
  queueAll(points: PointerPoint[]): this
  flushBatch(): PointerPoint[]
  isBatchingEnabled: boolean
  pendingCount: number
}
```

### 型定義

```ts
interface Point {
  x: number
  y: number
}

interface PointerPoint extends Point {
  pressure?: number
  timestamp: number
}

type PaddingMode = 'reflect' | 'edge' | 'zero'

interface BatchConfig {
  onBatch?: (points: PointerPoint[]) => void
  onPoint?: (point: PointerPoint) => void
}

interface StabilizedPointerOptions {
  appendEndpoint?: boolean // finish()で終点を追加（デフォルト: true）
}
```

## アーキテクチャ

```
入力 → [リアルタイムフィルタ] → process() → 出力
                                   ↓
                               [バッファ]
                                   ↓
                           [後処理] → finish() → 最終出力
```

**リアルタイムフィルタ**は各点でO(1)。
**後処理**はストローク終了時に双方向畳み込みで1回だけ実行。

## フレームワーク用

- `@stroke-stabilizer/react` - React hooks
- `@stroke-stabilizer/vue` - Vue composables

## ライセンス

[MIT](../../LICENSE)

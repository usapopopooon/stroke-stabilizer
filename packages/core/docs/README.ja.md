# @stroke-stabilizer/core

[![npm version](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)

[English](../README.md)

> これは [stroke-stabilizer](https://github.com/usapopopooon/stroke-stabilizer) モノレポの一部です

デジタルドローイングアプリケーション向けの軽量でフレームワーク非依存なストローク手ぶれ補正ライブラリです。

柔軟なフィルターパイプラインを使用して、リアルタイムでペン/マウス入力をスムーズにし、手の震えを軽減します。

## 特徴

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - ビルド不要で実行時にフィルターを追加・削除・更新
- **二層処理** - リアルタイムフィルター + ポストプロセス畳み込み
- **自動終点補正** - ストロークが実際の入力位置で終わる
- **rAF バッチ処理** - 高頻度ポインターイベントをアニメーションフレームに集約
- **8種類の組み込みフィルター** - 単純移動平均から適応型 One Euro Filter まで
- **エッジ保存スムージング** - バイラテラルカーネルによる鋭角保持
- **TypeScript ファースト** - 完全な型安全性と型エクスポート
- **依存ゼロ** - Pure JavaScript、どこでも動作

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

## フィルター

> **📖 [フィルター詳細リファレンス](../../../docs/filters.ja.md)** - 数式、技術的な説明、使用推奨事項

### リアルタイムフィルター

| フィルター               | 説明                     | 用途                           |
| ------------------------ | ------------------------ | ------------------------------ |
| `noiseFilter`            | 近接した点を拒否         | ジッター除去                   |
| `movingAverageFilter`    | 単純移動平均（FIR）      | 基本的なスムージング           |
| `emaFilter`              | 指数移動平均（IIR）      | 低遅延スムージング             |
| `kalmanFilter`           | カルマンフィルター       | ノイズの多い入力のスムージング |
| `stringFilter`           | Lazy Brush アルゴリズム  | 遅延のある滑らかなストローク   |
| `oneEuroFilter`          | 適応型ローパスフィルター | 滑らかさと遅延の最適バランス   |
| `linearPredictionFilter` | 次の位置を予測           | ラグ補正                       |

### ポストプロセスカーネル

| カーネル          | 説明                   |
| ----------------- | ---------------------- |
| `gaussianKernel`  | ガウシアンブラー       |
| `boxKernel`       | 単純平均               |
| `triangleKernel`  | 線形フォールオフ       |
| `bilateralKernel` | エッジ保存スムージング |

## 使用例

### 基本的なリアルタイム安定化

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer().addFilter(
  oneEuroFilter({ minCutoff: 1.0, beta: 0.007 })
)

// 各点を処理
const smoothed = pointer.process({ x, y, timestamp })
```

### 動的フィルター更新

```ts
// フィルター追加
pointer.addFilter(emaFilter({ alpha: 0.3 }))

// 実行時にパラメータ更新
pointer.updateFilter('ema', { alpha: 0.5 })

// フィルター削除
pointer.removeFilter('ema')
```

### 双方向畳み込みによるポストプロセス

```ts
import { StabilizedPointer, gaussianKernel } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .addPostProcess(gaussianKernel({ size: 7 }), { padding: 'reflect' })

// リアルタイムで点を処理
pointer.process(point)

// ストローク終了後、ポストプロセスを適用
const finalPoints = pointer.finish()
```

### ポストプロセスの再適用

`finishWithoutReset()` を使用すると、バッファを失わずに異なる設定でポストプロセスをプレビューまたは再適用できます。

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

// ガウシアンカーネルでプレビュー
pointer.addPostProcess(gaussianKernel({ size: 5 }))
const preview1 = pointer.finishWithoutReset()
draw(preview1)

// バイラテラルカーネルに変更して再適用
pointer.removePostProcess('gaussian')
pointer.addPostProcess(bilateralKernel({ size: 7, sigmaValue: 10 }))
const preview2 = pointer.finishWithoutReset()
draw(preview2)

// 満足したら確定（バッファをリセット）
const final = pointer.finish()
```

**`finishWithoutReset()` と `finish()` の違い：**

| メソッド               | ポストプロセス | バッファリセット |
| ---------------------- | -------------- | ---------------- |
| `finishWithoutReset()` | ✅             | ❌               |
| `finish()`             | ✅             | ✅               |

### エッジ保存スムージング

```ts
import { smooth, bilateralKernel } from '@stroke-stabilizer/core'

// 鋭角を保持しながらスムーズ化
const smoothed = smooth(points, {
  kernel: bilateralKernel({ size: 7, sigmaValue: 10 }),
  padding: 'reflect',
})
```

### 自動終点補正

デフォルトでは、`finish()` は自動的に生の終点を追加し、ストロークが実際の入力位置で終わるようにします。オプションで無効化できます。

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

// デフォルト：終点補正有効（推奨）
const pointer = new StabilizedPointer()
pointer.addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))

// 点を処理...
pointer.process(point1)
pointer.process(point2)

// finish() は最後の生の点を自動的に追加
const finalPoints = pointer.finish()

// 終点補正を無効化
const pointerNoEndpoint = new StabilizedPointer({ appendEndpoint: false })
```

### smooth() での終点保存

デフォルトでは、`smooth()` は正確な始点と終点を保存し、ストロークが実際のポインタ位置に到達するようにします。

```ts
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

// デフォルト：終点が保存される（推奨）
const smoothed = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
})

// 終点保存を無効化
const smoothedAll = smooth(points, {
  kernel: gaussianKernel({ size: 5 }),
  preserveEndpoints: false,
})
```

### rAF バッチ処理

高頻度入力デバイス（ペンタブレットなど）向けに、バッチ処理はポインターイベントをアニメーションフレームに集約してCPU負荷を削減します。

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .enableBatching({
    onBatch: (points) => {
      // フレームごとに1回、すべての処理済み点と共に呼び出される
      drawPoints(points)
    },
    onPoint: (point) => {
      // 各処理済み点ごとに呼び出される（オプション）
      updatePreview(point)
    },
  })

canvas.addEventListener('pointermove', (e) => {
  // 点はキューに入れられ、次のアニメーションフレームで処理される
  pointer.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
})

canvas.addEventListener('pointerup', () => {
  // 保留中の点をフラッシュしてポストプロセスを適用
  const finalPoints = pointer.finish()
})
```

**バッチ処理メソッド：**

```ts
// バッチ処理の有効化/無効化（メソッドチェーン）
pointer.enableBatching({ onBatch, onPoint })
pointer.disableBatching()

// バッチ処理用に点をキュー
pointer.queue(point)
pointer.queueAll(points)

// 即座に処理を強制
pointer.flushBatch()

// 状態確認
pointer.isBatchingEnabled // boolean
pointer.pendingCount // キューに入っている点の数
```

### プリセット

```ts
import { createFromPreset } from '@stroke-stabilizer/core'

// 事前定義された設定で素早くセットアップ
const pointer = createFromPreset('smooth') // 強いスムージング
const pointer = createFromPreset('responsive') // 低遅延
const pointer = createFromPreset('balanced') // デフォルトバランス
```

## フィルターパラメータ

### oneEuroFilter（推奨）

```ts
oneEuroFilter({
  minCutoff: 1.0, // 低速時のスムージング（低いほど滑らか）
  beta: 0.007, // 速度適応（高いほど応答性向上）
  dCutoff: 1.0, // 微分カットオフ（通常1.0）
})
```

### emaFilter

```ts
emaFilter({
  alpha: 0.5, // 0-1、高いほど応答性向上
})
```

### kalmanFilter

```ts
kalmanFilter({
  processNoise: 0.1, // 予想される移動の分散
  measurementNoise: 0.5, // 入力ノイズレベル
})
```

### linearPredictionFilter

```ts
linearPredictionFilter({
  historySize: 4, // 予測に使用する点数
  predictionFactor: 0.5, // 予測強度（0-1）
  smoothing: 0.6, // 出力スムージング
})
```

### stringFilter（Lazy Brush）

```ts
stringFilter({
  stringLength: 10, // アンカーが移動するまでの距離
})
```

### bilateralKernel

```ts
bilateralKernel({
  size: 7, // カーネルサイズ（奇数）
  sigmaValue: 10, // エッジ保存（低いほど鋭いエッジ）
  sigmaSpace: 2, // 空間的フォールオフ（オプション）
})
```

## API リファレンス

### StabilizedPointer

```ts
class StabilizedPointer {
  // コンストラクタ
  constructor(options?: StabilizedPointerOptions)

  // フィルター管理
  addFilter(filter: Filter): this
  removeFilter(type: string): boolean
  updateFilter<T>(type: string, params: Partial<T>): boolean
  getFilter(type: string): Filter | undefined

  // ポストプロセス
  addPostProcess(kernel: Kernel, options?: { padding?: PaddingMode }): this
  removePostProcess(type: string): boolean

  // 処理
  process(point: PointerPoint): PointerPoint | null
  finish(): Point[] // ポストプロセス適用してリセット
  finishWithoutReset(): Point[] // リセットなしでポストプロセス適用（プレビュー用）
  reset(): void // フィルターをリセットしてバッファをクリア

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
  appendEndpoint?: boolean // finish() 時に生の終点を追加（デフォルト: true）
}
```

## アーキテクチャ

```
入力 → [リアルタイムフィルター] → process() → 出力
                                    ↓
                                [バッファ]
                                    ↓
                          [ポストプロセッサ] → finish() → 最終出力
```

**リアルタイムフィルター**は各入力点に対してO(1)の計算量で実行されます。
**ポストプロセッサ**はストローク終了時に双方向畳み込みで1回実行されます。

## フレームワークアダプター

- `@stroke-stabilizer/react` - React hooks
- `@stroke-stabilizer/vue` - Vue composables

## ライセンス

[MIT](../../LICENSE)

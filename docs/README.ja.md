# stroke-stabilizer

[English](../README.md)

デジタルドローイングアプリケーション向けのストローク手ぶれ補正ライブラリのモノレポです。

## パッケージ

| パッケージ                                      | バージョン                                                                                                                          | 説明                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| [@stroke-stabilizer/core](./packages/core)      | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)           | コアライブラリ（vanilla JS） |
| [@stroke-stabilizer/react](./packages/react)    | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react)         | React hooks            |
| [@stroke-stabilizer/vue](./packages/vue)        | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)             | Vue composables        |

## 特徴

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - ビルド不要で実行時にフィルターを追加・削除・更新
- **二層処理** - リアルタイムフィルター + ポストプロセス畳み込み
- **rAF バッチ処理** - 高頻度ポインターイベントをアニメーションフレームに集約
- **8種類の組み込みフィルター** - 単純移動平均から適応型 One Euro Filter まで
- **エッジ保存スムージング** - バイラテラルカーネルによる鋭角保持
- **TypeScript ファースト** - 完全な型安全性
- **依存ゼロ** - Pure JavaScript

## クイックスタート

```bash
npm install @stroke-stabilizer/core
```

```ts
import { StabilizedPointer, oneEuroFilter } from '@stroke-stabilizer/core'

const pointer = new StabilizedPointer()
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
  .enableBatching({
    onBatch: (points) => drawPoints(points),
  })

canvas.addEventListener('pointermove', (e) => {
  pointer.queue({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure,
    timestamp: e.timeStamp,
  })
})
```

詳細なドキュメントは [@stroke-stabilizer/core README](./packages/core/docs/README.ja.md) を参照してください。

## ライセンス

[MIT](./LICENSE)

# stroke-stabilizer

[English](../README.md)

お絵描きアプリ向けの手ぶれ補正ライブラリです。

## パッケージ

| パッケージ                                   | バージョン                                                                                                                  | 説明               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| [@stroke-stabilizer/core](./packages/core)   | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/core.svg)](https://www.npmjs.com/package/@stroke-stabilizer/core)   | コア（vanilla JS） |
| [@stroke-stabilizer/react](./packages/react) | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/react.svg)](https://www.npmjs.com/package/@stroke-stabilizer/react) | React hooks        |
| [@stroke-stabilizer/vue](./packages/vue)     | [![npm](https://img.shields.io/npm/v/@stroke-stabilizer/vue.svg)](https://www.npmjs.com/package/@stroke-stabilizer/vue)     | Vue composables    |

## デモ

**[usapopopooon.github.io/stroke-stabilizer](https://usapopopooon.github.io/stroke-stabilizer/)** で試せます。

## サンプル

フィルタを動的に切り替えられるデモ：

- [Vanilla JS](../examples/vanilla/)
- [React](../examples/react/)
- [Vue](../examples/vue/)

## ドキュメント

- **[フィルタリファレンス](./filters.ja.md)** - 各フィルタ・カーネルの詳細（数式付き）

## 特徴

- **[Dynamic Pipeline Pattern](https://dev.to/usapopopooon/the-dynamic-pipeline-pattern-a-mutable-method-chaining-for-real-time-processing-16e1)** - フィルタを実行時に追加・削除・更新できる
- **二層処理** - リアルタイムフィルタ＋後処理の畳み込み
- **終点補正** - ストロークが入力位置で終わる
- **rAFバッチ処理** - ポインタイベントをフレーム単位にまとめてCPU負荷を軽減
- **8種類のフィルタ** - 移動平均からOne Euro Filterまで
- **エッジ保存** - バイラテラルカーネルで角を潰さずスムーズに
- **TypeScript対応** - 型定義付き
- **依存なし** - Pure JavaScript

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

詳しくは [@stroke-stabilizer/core README](./packages/core/docs/README.ja.md) を見てください。

## ライセンス

[MIT](./LICENSE)

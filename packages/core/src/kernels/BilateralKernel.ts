import type { Point } from '../types'

export interface BilateralKernelParams {
  /**
   * カーネルサイズ（奇数）
   * 推奨: 5-11
   */
  size: number
  /**
   * 空間方向の標準偏差
   * インデックス距離による重み減衰
   * 推奨: size / 3
   */
  sigmaSpace?: number
  /**
   * 値方向の標準偏差
   * 座標値の差による重み減衰（エッジ保存）
   * 小さいほどエッジを強く保存
   * 推奨: 5-30
   */
  sigmaValue: number
}

export interface BilateralKernel {
  readonly type: 'bilateral'
  readonly size: number
  readonly sigmaSpace: number
  readonly sigmaValue: number
  /**
   * 各ポイントに対する重みを動的に計算
   */
  computeWeights(center: Point, neighbors: Point[]): number[]
}

/**
 * バイラテラルカーネルを生成
 *
 * 通常の畳み込みと異なり、座標値の類似度も考慮して重みを決定する。
 * これにより、エッジ（急な方向転換など）を保存しながら平滑化できる。
 *
 * @example
 * ```ts
 * const kernel = bilateralKernel({
 *   size: 7,
 *   sigmaValue: 10
 * })
 * ```
 */
export function bilateralKernel(
  params: BilateralKernelParams
): BilateralKernel {
  const { size, sigmaValue } = params
  const actualSize = size % 2 === 0 ? size + 1 : size
  const sigmaSpace = params.sigmaSpace ?? actualSize / 3

  const halfSize = Math.floor(actualSize / 2)

  // 空間方向の重みを事前計算
  const spatialWeights: number[] = []
  for (let i = 0; i < actualSize; i++) {
    const d = i - halfSize
    spatialWeights.push(Math.exp(-(d * d) / (2 * sigmaSpace * sigmaSpace)))
  }

  return {
    type: 'bilateral',
    size: actualSize,
    sigmaSpace,
    sigmaValue,

    computeWeights(center: Point, neighbors: Point[]): number[] {
      const weights: number[] = []
      let sum = 0

      for (let i = 0; i < neighbors.length; i++) {
        // 座標値の差を計算
        const dx = neighbors[i].x - center.x
        const dy = neighbors[i].y - center.y
        const valueDiff = dx * dx + dy * dy

        // 値方向の重み
        const valueWeight = Math.exp(-valueDiff / (2 * sigmaValue * sigmaValue))

        // 空間 × 値 の重み
        const weight = spatialWeights[i] * valueWeight
        weights.push(weight)
        sum += weight
      }

      // 正規化
      if (sum > 0) {
        for (let i = 0; i < weights.length; i++) {
          weights[i] /= sum
        }
      }

      return weights
    },
  }
}

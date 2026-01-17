# Filter Reference

[日本語](./filters.ja.md)

This document provides detailed explanations of all filters and kernels available in stroke-stabilizer, including their mathematical foundations and practical applications.

## Table of Contents

### Real-time Filters

- [Noise Filter](#noise-filter)
- [Moving Average Filter](#moving-average-filter)
- [EMA Filter (Exponential Moving Average)](#ema-filter-exponential-moving-average)
- [Kalman Filter](#kalman-filter)
- [One Euro Filter](#one-euro-filter)
- [String Filter (Lazy Brush)](#string-filter-lazy-brush)
- [Linear Prediction Filter](#linear-prediction-filter)

### Post-processing Kernels

- [Gaussian Kernel](#gaussian-kernel)
- [Box Kernel](#box-kernel)
- [Triangle Kernel](#triangle-kernel)
- [Bilateral Kernel](#bilateral-kernel)

### Concepts

- [FIR vs IIR Filters](#fir-vs-iir-filters)
- [Convolution and Padding](#convolution-and-padding)

---

## Real-time Filters

Real-time filters process each input point immediately with O(1) time complexity, making them suitable for live drawing applications.

### Noise Filter

**Purpose:** Reject points that are too close together, eliminating high-frequency jitter.

**How it works:**

The noise filter maintains the last accepted point and rejects any new point within a minimum distance threshold.

```
if distance(current, lastAccepted) < minDistance:
    reject point
else:
    accept point
```

**Mathematical formula:**

$$d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

Where $d$ is the Euclidean distance between consecutive points.

**Parameters:**

| Parameter     | Type   | Default | Description                              |
| ------------- | ------ | ------- | ---------------------------------------- |
| `minDistance` | number | 2       | Minimum distance (pixels) between points |

**Guidelines:**

- 2.0: Standard setting. Removes fine jitter while maintaining precision
- 5.0+: For coarse input. May reduce point count too much

**When to use:**

- When input has micro-tremors or jitter
- As a first filter in the pipeline to reduce unnecessary points
- When you want to reduce the number of points without smoothing

**Example:**

```ts
import { noiseFilter } from '@stroke-stabilizer/core'

// Reject points closer than 3 pixels
const filter = noiseFilter({ minDistance: 3 })
```

---

### Moving Average Filter

**Purpose:** Smooth input using a simple moving average (SMA) over the last N points.

**How it works:**

This is a **FIR (Finite Impulse Response)** filter that averages the last N points with equal weights.

**Mathematical formula:**

$$\bar{x}_n = \frac{1}{N} \sum_{i=0}^{N-1} x_{n-i}$$

Where:

- $\bar{x}_n$ is the smoothed output at time $n$
- $N$ is the window size
- $x_{n-i}$ are the previous input points

**Parameters:**

| Parameter    | Type   | Default | Description                  |
| ------------ | ------ | ------- | ---------------------------- |
| `windowSize` | number | 5       | Number of points to average  |
| `weights`    | array  | uniform | Optional custom weight array |

**Characteristics:**

- **Latency:** $(N-1)/2$ points of delay
- **Smoothness:** Higher N = smoother but more lag
- **Memory:** Stores last N points

**When to use:**

- Simple smoothing requirements
- When consistent, predictable behavior is needed
- Educational purposes (easy to understand)

**Example:**

```ts
import { movingAverageFilter } from '@stroke-stabilizer/core'

// 7-point moving average
const filter = movingAverageFilter({ windowSize: 7 })

// Custom weighted moving average (center-heavy)
const weighted = movingAverageFilter({
  windowSize: 5,
  weights: [0.1, 0.2, 0.4, 0.2, 0.1],
})
```

---

### EMA Filter (Exponential Moving Average)

**Purpose:** Smooth input with exponentially decreasing weights on older values, providing low-latency smoothing.

**How it works:**

This is an **IIR (Infinite Impulse Response)** filter where each output depends on the previous output and the current input. Recent values have more influence than older ones.

**Mathematical formula:**

$$y_n = \alpha \cdot x_n + (1 - \alpha) \cdot y_{n-1}$$

Where:

- $y_n$ is the smoothed output at time $n$
- $x_n$ is the current input
- $\alpha$ is the smoothing factor (0 < α ≤ 1)
- $y_{n-1}$ is the previous output

**Parameters:**

| Parameter | Type   | Default | Description                                      |
| --------- | ------ | ------- | ------------------------------------------------ |
| `alpha`   | number | 0.5     | Smoothing factor (0-1). Higher = more responsive |

**Understanding alpha:**

- $\alpha = 1.0$: No smoothing (output = input)
- $\alpha = 0.5$: Moderate smoothing
- $\alpha = 0.1$: Heavy smoothing (slow response)

**Characteristics:**

- **Latency:** Lower than moving average for equivalent smoothing
- **Memory:** Only stores one previous value (O(1) space)
- **Impulse response:** Decays exponentially, never truly zero

**When to use:**

- Low-latency requirements
- Memory-constrained environments
- When you need adjustable smoothing with a single parameter

**Example:**

```ts
import { emaFilter } from '@stroke-stabilizer/core'

// Moderate smoothing
const filter = emaFilter({ alpha: 0.5 })

// Very smooth (more lag)
const smooth = emaFilter({ alpha: 0.2 })

// Very responsive (less smooth)
const responsive = emaFilter({ alpha: 0.8 })
```

---

### Kalman Filter

**Purpose:** Optimal state estimation for noisy input using a position-only model.

**How it works:**

The Kalman filter is a recursive algorithm that estimates the true state of a system from noisy measurements. It maintains an internal model that predicts the next state and then corrects this prediction based on actual measurements.

**Mathematical model:**

This implementation uses a simplified position-only model (no velocity) for stability with high-frequency input devices (144Hz+).

**Prediction step:**

$$\hat{x}_{k|k-1} = \hat{x}_{k-1|k-1}$$
$$P_{k|k-1} = P_{k-1|k-1} + Q$$

**Update step:**

$$K_k = \frac{P_{k|k-1}}{P_{k|k-1} + R}$$
$$\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k \cdot (z_k - \hat{x}_{k|k-1})$$

Where:

- $Q$ is the process noise covariance
- $R$ is the measurement noise covariance
- $K_k$ is the Kalman gain
- $z_k$ is the measurement

**Parameters:**

| Parameter          | Type   | Default | Description                                 |
| ------------------ | ------ | ------- | ------------------------------------------- |
| `processNoise`     | number | 0.1     | Expected variance in movement (Q)           |
| `measurementNoise` | number | 0.5     | Expected variance in input measurements (R) |

**Guidelines (when using strength 0-100):**

The examples use a 0-100 strength value converted as follows:

```ts
const t = strength / 100
processNoise: 1.0 - t * 0.9      // 1.0 → 0.1
measurementNoise: 0.05 + t * 0.95 // 0.05 → 1.0
```

- strength 10: Light correction. Responsive with subtle vibration removal
- strength 30-50: Standard setting. Balanced smoothing
- strength 80+: Heavy correction. Noticeable lag but very smooth

**Understanding the parameters:**

- **High processNoise:** Expects rapid, unpredictable movement → more responsive
- **High measurementNoise:** Expects noisy input → more smoothing
- **Ratio matters:** `measurementNoise / processNoise` determines smoothing level

**Characteristics:**

- **Optimal:** Minimizes mean squared error under Gaussian noise assumptions
- **Adaptive:** Kalman gain adjusts based on confidence in prediction vs measurement
- **Stable:** Position-only model prevents runaway behavior with high-frequency input

**When to use:**

- Noisy input from trembling hands
- When you need adaptive smoothing based on input quality
- Scientific/engineering applications requiring optimal estimation

**Example:**

```ts
import { kalmanFilter } from '@stroke-stabilizer/core'

// Default settings
const filter = kalmanFilter()

// More trust in input (less smoothing)
const responsive = kalmanFilter({
  processNoise: 0.5,
  measurementNoise: 0.2,
})

// Less trust in input (more smoothing)
const smooth = kalmanFilter({
  processNoise: 0.05,
  measurementNoise: 1.0,
})
```

---

### One Euro Filter

**Purpose:** Speed-adaptive lowpass filter that provides smooth output at low speeds and responsive output at high speeds.

**How it works:**

The One Euro Filter is an adaptive first-order lowpass filter. It dynamically adjusts its cutoff frequency based on input speed: when moving slowly, it uses a low cutoff (more smoothing), and when moving quickly, it uses a high cutoff (less smoothing, less lag).

**Mathematical formula:**

The filter uses an exponential smoothing with adaptive alpha:

$$\alpha = \frac{1}{1 + \frac{\tau}{T_e}}$$

Where:

- $\tau = \frac{1}{2\pi f_c}$ (time constant)
- $f_c$ is the cutoff frequency
- $T_e$ is the time between samples

The cutoff frequency is adapted based on speed:

$$f_c = f_{c,min} + \beta \cdot |\dot{x}|$$

Where:

- $f_{c,min}$ is the minimum cutoff frequency
- $\beta$ is the speed coefficient
- $|\dot{x}|$ is the absolute derivative (speed)

**Parameters:**

| Parameter   | Type   | Default | Description                                     |
| ----------- | ------ | ------- | ----------------------------------------------- |
| `minCutoff` | number | 1.0     | Minimum cutoff frequency (Hz). Lower = smoother |
| `beta`      | number | 0.007   | Speed coefficient. Higher = more responsive     |
| `dCutoff`   | number | 1.0     | Cutoff frequency for derivative (usually 1.0)   |

**Tuning guide:**

1. Start with `beta = 0` and adjust `minCutoff` for desired smoothing at low speed
2. Increase `beta` to reduce lag at high speed
3. Fine-tune both parameters for your use case

**Characteristics:**

- **Adaptive:** Less lag at high speed, more smoothing at low speed
- **Low latency:** One of the best smoothing-to-lag ratios
- **Simple:** Only 3 parameters to tune

**When to use:**

- Drawing applications (recommended default)
- When you need the best balance of smoothing and responsiveness
- Signature capture, handwriting input

**Example:**

```ts
import { oneEuroFilter } from '@stroke-stabilizer/core'

// Default settings (good starting point)
const filter = oneEuroFilter({
  minCutoff: 1.0,
  beta: 0.007,
})

// More smoothing at low speed
const smooth = oneEuroFilter({
  minCutoff: 0.5,
  beta: 0.007,
})

// More responsive at high speed
const responsive = oneEuroFilter({
  minCutoff: 1.0,
  beta: 0.02,
})
```

**Reference:** Casiez, G., Roussel, N., & Vogel, D. (2012). "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"

---

### String Filter (Lazy Brush)

**Purpose:** Create a "pulled string" effect where output lags behind input as if connected by a string of fixed length.

**How it works:**

Imagine the output point is connected to the input point by a string of fixed length. The output only moves when the input is far enough to "pull" it. This creates smooth, deliberate strokes with reduced jitter.

**Mathematical model:**

```
distance = |input - output|

if distance > stringLength:
    direction = normalize(input - output)
    output = input - direction * stringLength
else:
    output stays in place
```

**Parameters:**

| Parameter      | Type   | Default | Description                           |
| -------------- | ------ | ------- | ------------------------------------- |
| `stringLength` | number | 10      | Length of the virtual string (pixels) |

**Guidelines:**

- 5-10: Light correction. Natural follow-through feel
- 15-30: Stronger correction. Smooth but noticeable lag
- 50+: For calligraphy. Very deliberate strokes

**Characteristics:**

- **Deliberate lag:** Output intentionally follows behind
- **Direction smoothing:** Eliminates direction changes smaller than string length
- **No jitter:** Small movements are completely filtered out

**When to use:**

- Artistic drawing where deliberate, smooth strokes are desired
- When you want a "pulled brush" feel
- Calligraphy applications

**Example:**

```ts
import { stringFilter } from '@stroke-stabilizer/core'

// Short string (subtle effect)
const subtle = stringFilter({ stringLength: 5 })

// Long string (strong effect, more deliberate)
const strong = stringFilter({ stringLength: 20 })
```

**Also known as:** Lazy Brush, Pulled String Stabilizer

---

### Linear Prediction Filter

**Purpose:** Predict the next position based on velocity to compensate for filter lag.

**How it works:**

This filter estimates velocity from recent points and uses it to predict where the input "should" be, compensating for lag introduced by other filters in the pipeline.

**Mathematical formula:**

$$\hat{x}_{n+1} = x_n + v_n \cdot k$$

Where:

- $\hat{x}_{n+1}$ is the predicted position
- $x_n$ is the current position
- $v_n$ is the estimated velocity
- $k$ is the prediction factor

Velocity is estimated using linear regression over the history:

$$v = \frac{\sum_{i=1}^{N} (x_i - x_{i-1}) / \Delta t_i}{N}$$

**Parameters:**

| Parameter          | Type   | Default | Description                              |
| ------------------ | ------ | ------- | ---------------------------------------- |
| `historySize`      | number | 4       | Number of points for velocity estimation |
| `predictionFactor` | number | 0.5     | How far ahead to predict (0-1)           |
| `smoothing`        | number | 0.6     | Smoothing applied to output              |

**Characteristics:**

- **Lag compensation:** Can reduce perceived lag from other filters
- **Overshooting risk:** High prediction factors may overshoot on direction changes
- **Best combined:** Usually used with smoothing filters

**When to use:**

- To reduce lag when combined with heavy smoothing
- Real-time drawing where responsiveness is critical
- After other filters to compensate for their delay

**Example:**

```ts
import { linearPredictionFilter } from '@stroke-stabilizer/core'

// Conservative prediction
const conservative = linearPredictionFilter({
  historySize: 4,
  predictionFactor: 0.3,
  smoothing: 0.7,
})

// Aggressive prediction (may overshoot)
const aggressive = linearPredictionFilter({
  historySize: 6,
  predictionFactor: 0.7,
  smoothing: 0.4,
})
```

---

## Post-processing Kernels

Post-processing kernels are applied after the stroke is complete using bidirectional convolution. This allows for smoother results than real-time processing since the entire stroke is available.

### Gaussian Kernel

**Purpose:** Apply Gaussian-weighted smoothing for natural-looking blur.

**How it works:**

The Gaussian kernel weights neighboring points based on their distance, with closer points having more influence. This produces smooth, natural-looking results.

**Mathematical formula:**

$$G(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{x^2}{2\sigma^2}}$$

Where:

- $\sigma$ is the standard deviation
- $x$ is the distance from center

For discrete kernels, weights are computed and normalized:

$$w_i = e^{-\frac{i^2}{2\sigma^2}}$$

**Parameters:**

| Parameter | Type   | Default | Description                          |
| --------- | ------ | ------- | ------------------------------------ |
| `size`    | number | 5       | Kernel size (odd number)             |
| `sigma`   | number | auto    | Standard deviation (default: size/6) |

**Guidelines:**

- size 3: Light correction. Preserves almost original shape
- size 5-7: Standard setting. Moderately smooth
- size 11+: Heavy correction. Corners tend to round off

**Characteristics:**

- **Smooth falloff:** Weights decrease smoothly from center
- **Frequency response:** Low-pass filter with gradual rolloff
- **Standard choice:** Most commonly used smoothing kernel

**When to use:**

- General-purpose smoothing
- When you want natural-looking results
- Default choice for post-processing

**Example:**

```ts
import { gaussianKernel } from '@stroke-stabilizer/core'

// Small kernel (subtle smoothing)
const subtle = gaussianKernel({ size: 3 })

// Large kernel (strong smoothing)
const strong = gaussianKernel({ size: 11 })

// Custom sigma
const custom = gaussianKernel({ size: 7, sigma: 1.5 })
```

---

### Box Kernel

**Purpose:** Apply uniform averaging over a window (simple moving average).

**How it works:**

All points within the window have equal weight. Simple and fast, but may produce less natural results than Gaussian.

**Mathematical formula:**

$$w_i = \frac{1}{N}$$

Where $N$ is the kernel size.

**Parameters:**

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `size`    | number | 5       | Kernel size (odd number) |

**Characteristics:**

- **Uniform weights:** All neighbors contribute equally
- **Sharper edges:** May preserve edges better than Gaussian
- **Faster:** Simplest computation

**When to use:**

- When computational speed matters
- When uniform averaging is specifically desired
- Educational purposes

**Example:**

```ts
import { boxKernel } from '@stroke-stabilizer/core'

const kernel = boxKernel({ size: 5 })
```

---

### Triangle Kernel

**Purpose:** Apply linear falloff weighting, a middle ground between box and Gaussian.

**How it works:**

Weights decrease linearly from the center to the edges, providing smoother results than box kernel but with a different character than Gaussian.

**Mathematical formula:**

$$w_i = 1 - \frac{|i|}{r}$$

Where $r$ is the kernel radius (half of size).

**Parameters:**

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `size`    | number | 5       | Kernel size (odd number) |

**Characteristics:**

- **Linear falloff:** Weights decrease linearly from center
- **Moderate smoothing:** Between box and Gaussian in smoothness
- **Zero at edges:** Unlike Gaussian, reaches exactly zero at kernel edges

**When to use:**

- When Gaussian is too smooth
- When box kernel is too harsh
- When you want a simple, intuitive falloff

**Example:**

```ts
import { triangleKernel } from '@stroke-stabilizer/core'

const kernel = triangleKernel({ size: 7 })
```

---

### Bilateral Kernel

**Purpose:** Edge-preserving smoothing that maintains sharp corners while smoothing gradual curves.

**How it works:**

The bilateral kernel considers both spatial distance (like Gaussian) and value similarity. Points that are both nearby AND similar in value receive high weights. Points that are nearby but different in value (edges) receive low weights, preserving the edge.

**Mathematical formula:**

$$w_{ij} = G_s(||p_i - p_j||) \cdot G_r(|I_i - I_j|)$$

Where:

- $G_s$ is the spatial Gaussian (based on position)
- $G_r$ is the range Gaussian (based on value difference)
- $p_i, p_j$ are positions
- $I_i, I_j$ are values (coordinates in our case)

**Parameters:**

| Parameter    | Type   | Default | Description                               |
| ------------ | ------ | ------- | ----------------------------------------- |
| `size`       | number | 5       | Kernel size (odd number)                  |
| `sigmaSpace` | number | auto    | Spatial standard deviation                |
| `sigmaValue` | number | 10      | Value standard deviation (edge threshold) |

**Guidelines:**

- size 5-7, sigmaValue 10: Standard setting. Smooth while preserving corners
- size 9+, sigmaValue 5: Strong edge preservation. Corners remain nearly intact
- size 11+, sigmaValue 20+: Approaches Gaussian behavior. Corners round off

**Understanding sigmaValue:**

- **Low sigmaValue:** Stronger edge preservation (points must be very similar)
- **High sigmaValue:** Weaker edge preservation (approaches Gaussian)

**Characteristics:**

- **Edge-preserving:** Maintains sharp corners and direction changes
- **Adaptive:** Automatically detects and preserves edges
- **Slower:** More computation than other kernels

**When to use:**

- When you need to preserve sharp corners
- Geometric drawing where angles matter
- When Gaussian over-smooths your corners

**Example:**

```ts
import { bilateralKernel } from '@stroke-stabilizer/core'

// Strong edge preservation
const sharp = bilateralKernel({
  size: 7,
  sigmaValue: 5,
})

// Moderate edge preservation
const moderate = bilateralKernel({
  size: 7,
  sigmaValue: 15,
})
```

---

## Concepts

### FIR vs IIR Filters

**FIR (Finite Impulse Response):**

- Output depends only on current and past inputs
- Examples: Moving Average, Convolution kernels
- Characteristics: Linear phase, stable, predictable delay

**IIR (Infinite Impulse Response):**

- Output depends on past outputs as well as inputs
- Examples: EMA, Kalman, One Euro
- Characteristics: Can achieve same smoothing with less computation, but may have phase distortion

### Convolution and Padding

Post-processing uses **bidirectional convolution**, applying the kernel in both directions for symmetric smoothing.

**Padding modes** handle edge effects:

| Mode      | Description                 | Best for                          |
| --------- | --------------------------- | --------------------------------- |
| `reflect` | Mirror values at boundaries | Most natural results              |
| `edge`    | Repeat edge values          | When reflection creates artifacts |
| `zero`    | Pad with zeros              | When edges should fade            |

**Endpoint preservation:**

By default, `smooth()` preserves the exact start and end points of the stroke. This ensures the stabilized stroke reaches the actual position where the pointer was lifted.

| Option              | Default | Description                                      |
| ------------------- | ------- | ------------------------------------------------ |
| `preserveEndpoints` | `true`  | Keep original start/end points after convolution |

**Example:**

```ts
import { smooth, gaussianKernel } from '@stroke-stabilizer/core'

// Default: endpoints are preserved
const smoothed = smooth(points, {
  kernel: gaussianKernel({ size: 7 }),
  padding: 'reflect',
})

// Disable endpoint preservation (endpoints may drift)
const smoothedAll = smooth(points, {
  kernel: gaussianKernel({ size: 7 }),
  padding: 'reflect',
  preserveEndpoints: false,
})
```

---

## Filter Combinations

### Recommended Combinations

**Drawing (general):**

```ts
pointer
  .addFilter(noiseFilter({ minDistance: 2 }))
  .addFilter(oneEuroFilter({ minCutoff: 1.0, beta: 0.007 }))
```

**High precision:**

```ts
pointer
  .addFilter(noiseFilter({ minDistance: 1 }))
  .addFilter(kalmanFilter({ processNoise: 0.1, measurementNoise: 0.3 }))
  .addPostProcess(gaussianKernel({ size: 5 }))
```

**Calligraphy/artistic:**

```ts
pointer
  .addFilter(stringFilter({ stringLength: 15 }))
  .addFilter(emaFilter({ alpha: 0.4 }))
```

**Maximum smoothness with edge preservation:**

```ts
pointer
  .addFilter(oneEuroFilter({ minCutoff: 0.5, beta: 0.01 }))
  .addPostProcess(bilateralKernel({ size: 9, sigmaValue: 8 }))
```

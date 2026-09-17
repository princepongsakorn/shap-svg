/**
 * Two-component PCA of a SHAP matrix, the projection `shap.plots.embedding`
 * draws.
 *
 * SHAP calls `sklearn.decomposition.PCA(2).fit_transform(shap_values)`, which
 * centres each column and takes the top two right singular vectors. This does
 * the same with power iteration and one deflation step, because the package
 * carries no linear-algebra dependency and may not gain one.
 *
 * Determinism is required, not incidental: the starting vector is fixed and
 * each component's sign is normalised the way scikit-learn's `svd_flip` does,
 * so the same payload draws the same picture on every render and in every
 * golden test.
 */

export type PcaResult = {
  /** One [x, y] per Sample, in input order, already centred. */
  coords: [number, number][];
  /** Share of total variance each component explains, 0–1. */
  varianceRatios: [number, number];
};

/** Enough for the separation this chart needs; measured to converge well before it. */
const DEFAULT_ITERATIONS = 200;
/** Below this the component is noise and is reported as empty rather than as a direction. */
const EPSILON = 1e-12;

function centerColumns(values: number[][]): number[][] {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const means = new Array<number>(cols).fill(0);
  for (const row of values) for (let j = 0; j < cols; j++) means[j] += row[j];
  for (let j = 0; j < cols; j++) means[j] /= rows;
  return values.map((row) => row.map((v, j) => v - means[j]));
}

/** The leading right singular vector of `m`, by power iteration on mᵀm. */
function leadingComponent(m: number[][], iterations: number): number[] {
  const cols = m[0]?.length ?? 0;
  // A fixed, non-degenerate start: a constant vector is orthogonal to some
  // real components, so vary it by index.
  let v = Array.from({ length: cols }, (_, j) => 1 / (j + 1));
  normalise(v);

  for (let step = 0; step < iterations; step++) {
    // w = m v, then next = mᵀ w. Two passes avoid materialising mᵀm, which is
    // p x p and p reaches 865.
    const w = m.map((row) => {
      let sum = 0;
      for (let j = 0; j < cols; j++) sum += row[j] * v[j];
      return sum;
    });
    const next = new Array<number>(cols).fill(0);
    m.forEach((row, i) => {
      const weight = w[i];
      for (let j = 0; j < cols; j++) next[j] += row[j] * weight;
    });
    if (!normalise(next)) return new Array<number>(cols).fill(0);
    v = next;
  }
  return v;
}

/** Scales in place to unit length; false when the vector is all but zero. */
function normalise(v: number[]): boolean {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (!(norm > EPSILON)) return false;
  for (let j = 0; j < v.length; j++) v[j] /= norm;
  return true;
}

/** scikit-learn's `svd_flip`: the largest-magnitude loading is made positive. */
function fixSign(component: number[]): void {
  let peak = 0;
  for (const x of component) if (Math.abs(x) > Math.abs(peak)) peak = x;
  if (peak < 0) for (let j = 0; j < component.length; j++) component[j] = -component[j];
}

function project(m: number[][], component: number[]): number[] {
  return m.map((row) => {
    let sum = 0;
    for (let j = 0; j < row.length; j++) sum += row[j] * component[j];
    return sum;
  });
}

export function shapPca(values: number[][], iterations = DEFAULT_ITERATIONS): PcaResult {
  if (values.length === 0) return { coords: [], varianceRatios: [0, 0] };

  const centered = centerColumns(values);
  let total = 0;
  for (const row of centered) for (const v of row) total += v * v;

  const first = leadingComponent(centered, iterations);
  fixSign(first);
  const xs = project(centered, first);

  // Deflate: strip the first component's share, then repeat.
  const residual = centered.map((row, i) =>
    row.map((v, j) => v - xs[i] * first[j]),
  );
  const second = leadingComponent(residual, iterations);
  fixSign(second);
  const ys = project(residual, second);

  const energy = (projected: number[]) => projected.reduce((sum, v) => sum + v * v, 0);
  const ratio = (projected: number[]) => (total > EPSILON ? energy(projected) / total : 0);

  return {
    coords: xs.map((x, i) => [x, ys[i]] as [number, number]),
    varianceRatios: [ratio(xs), ratio(ys)],
  };
}

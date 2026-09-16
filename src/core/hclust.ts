/**
 * Hierarchical clustering of Features, for the bar chart's dendrogram.
 *
 * SHAP's own `shap.utils.hclust` measures *supervised* redundancy: it trains a
 * univariate XGBoost model per Feature and then one per ordered pair, asking
 * whether Feature j can reproduce Feature i's model of the target. A browser
 * cannot train gradient-boosted trees, so this clusters on `1 − |Pearson r|`
 * instead. The supervised measure is still available — computed in Python and
 * passed to the chart as a linkage matrix.
 *
 * The output is SciPy's linkage format, `(k−1) × 4` rows of
 * `[left, right, height, size]`, with leaves numbered `0..k-1` and merge `i`
 * numbered `k + i`. That is what `shap.plots.bar` validates its `clustering`
 * argument against, so the two paths are interchangeable.
 *
 * Average linkage, not SHAP's default single linkage: single linkage chains
 * badly on correlation distances, where two taxa sharing a handful of Samples
 * can drag unrelated clusters together.
 */

/** Two Features that never move together; also what an invariant Feature gets. */
const MAX_DISTANCE = 1;

function absCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (!(varA > 0) || !(varB > 0)) return 0;
  return Math.min(1, Math.abs(cov / Math.sqrt(varA * varB)));
}

/** `1 − |r|` between every pair of columns. */
export function correlationDistances(columns: number[][]): number[][] {
  const k = columns.length;
  const out = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const distance = MAX_DISTANCE - absCorrelation(columns[i], columns[j]);
      out[i][j] = distance;
      out[j][i] = distance;
    }
  }
  return out;
}

/**
 * Agglomerative average linkage.
 *
 * Ties merge the lowest cluster ids first, so the tree is reproducible; SciPy
 * makes the same guarantee and the golden tests depend on it.
 */
export function averageLinkage(distances: number[][]): number[][] {
  const k = distances.length;
  if (k < 2) return [];

  // Active clusters, keyed by their id (leaf ids first, then merge ids).
  const members = new Map<number, number[]>();
  for (let i = 0; i < k; i++) members.set(i, [i]);

  const between = (a: number[], b: number[]) => {
    let sum = 0;
    for (const i of a) for (const j of b) sum += distances[i][j];
    return sum / (a.length * b.length);
  };

  const linkage: number[][] = [];
  for (let step = 0; step < k - 1; step++) {
    const ids = [...members.keys()].sort((a, b) => a - b);
    let bestLeft = ids[0];
    let bestRight = ids[1];
    let bestDistance = Infinity;

    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const d = between(members.get(ids[a])!, members.get(ids[b])!);
        if (d < bestDistance - 1e-12) {
          bestDistance = d;
          bestLeft = ids[a];
          bestRight = ids[b];
        }
      }
    }

    const merged = [...members.get(bestLeft)!, ...members.get(bestRight)!];
    members.delete(bestLeft);
    members.delete(bestRight);
    members.set(k + step, merged);
    linkage.push([bestLeft, bestRight, bestDistance, merged.length]);
  }
  return linkage;
}

/** For every leaf pair, the height of the merge that first joined them. */
export function copheneticDistances(linkage: number[][]): number[][] {
  const k = linkage.length + 1;
  const out = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const leaves = new Map<number, number[]>();
  for (let i = 0; i < k; i++) leaves.set(i, [i]);

  linkage.forEach((row, step) => {
    const left = leaves.get(row[0])!;
    const right = leaves.get(row[1])!;
    for (const i of left) for (const j of right) {
      out[i][j] = row[2];
      out[j][i] = row[2];
    }
    leaves.set(k + step, [...left, ...right]);
  });
  return out;
}

/**
 * Leaf order for drawing: at each merge the side holding the largest leaf value
 * is emitted first, which is what `shap.plots._utils.sort_inds` does.
 */
export function leafOrder(linkage: number[][], leafValues: number[]): number[] {
  const k = linkage.length + 1;
  if (k === 1) return [0];

  const peak = new Map<number, number>();
  const children = new Map<number, [number, number]>();
  for (let i = 0; i < k; i++) peak.set(i, leafValues[i] ?? 0);
  linkage.forEach((row, step) => {
    const id = k + step;
    children.set(id, [row[0], row[1]]);
    peak.set(id, Math.max(peak.get(row[0]) ?? 0, peak.get(row[1]) ?? 0));
  });

  const out: number[] = [];
  const walk = (id: number): void => {
    const pair = children.get(id);
    if (!pair) {
      out.push(id);
      return;
    }
    const [left, right] = pair;
    const heavierFirst = (peak.get(left) ?? 0) >= (peak.get(right) ?? 0) ? [left, right] : [right, left];
    walk(heavierFirst[0]);
    walk(heavierFirst[1]);
  };
  walk(k + linkage.length - 1);
  return out;
}

/**
 * Relax the importance order towards the cluster order, exactly where the tree
 * is tight — `shap.plots._utils.get_sort_order`.
 *
 * Walk the importance order; each time a Feature is taken, take with it every
 * not-yet-taken Feature whose cophenetic distance to it is within the cutoff,
 * in cluster order. A loose tree therefore changes nothing.
 */
export function relaxSortOrder(
  cophenetic: number[][],
  clusterOrder: number[],
  cutoff: number,
  importanceOrder: number[],
): number[] {
  const taken = new Set<number>();
  const out: number[] = [];

  for (const index of importanceOrder) {
    if (taken.has(index)) continue;
    taken.add(index);
    out.push(index);
    for (const neighbour of clusterOrder) {
      if (taken.has(neighbour)) continue;
      if (cophenetic[index][neighbour] <= cutoff) {
        taken.add(neighbour);
        out.push(neighbour);
      }
    }
  }
  return out;
}

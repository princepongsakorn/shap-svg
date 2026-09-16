/**
 * Which other Feature interacts most with a given one — SHAP's
 * `approximate_interactions` (shap/utils/_general.py), ported.
 *
 * The method: sort Samples by the target Feature's value, walk them in fixed
 * windows, and sum |Pearson r| between each window's other-Feature values and
 * the correspondingly sorted SHAP values of the target. A Feature whose value
 * tracks the target's contribution within local neighbourhoods scores high.
 *
 * One deliberate change from SHAP. SHAP returns the raw sum, which grows with
 * the number of windows and so cannot be compared across Model outputs of
 * different size; this divides by the window count, giving a mean |r| in 0–1
 * that the chart can show and threshold on. SHAP also scores a missing-value
 * indicator and takes the larger of the two — the payload contract forbids NaN,
 * so that branch is dropped rather than ported dead.
 */

const MAX_WINDOW = 50;

/** SHAP's `inc`: max(min(floor(n / 10), 50), 1). */
export function interactionWindowSize(sampleCount: number): number {
  return Math.max(Math.min(Math.floor(sampleCount / 10), MAX_WINDOW), 1);
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
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
  return cov / Math.sqrt(varA * varB);
}

export function interactionScores(
  featureIndex: number,
  values: number[][],
  data: number[][],
): number[] {
  const sampleCount = data.length;
  const featureCount = data[0]?.length ?? 0;
  const scores = new Array<number>(featureCount).fill(0);
  if (sampleCount < 2) return scores;

  const order = Array.from({ length: sampleCount }, (_, i) => i).sort(
    (a, b) => data[a][featureIndex] - data[b][featureIndex] || a - b,
  );
  const sortedShap = order.map((i) => values[i][featureIndex]);
  const window = interactionWindowSize(sampleCount);
  const windowCount = Math.ceil(sampleCount / window);

  for (let j = 0; j < featureCount; j++) {
    if (j === featureIndex) continue;
    const sortedOther = order.map((i) => data[i][j]);
    // SHAP skips a Feature that is all but zero across the batch.
    let magnitude = 0;
    for (const v of sortedOther) magnitude += Math.abs(v);
    if (magnitude < 1e-8) continue;

    let sum = 0;
    for (let start = 0; start < sampleCount; start += window) {
      const shapSlice = sortedShap.slice(start, start + window);
      const otherSlice = sortedOther.slice(start, start + window);
      sum += Math.abs(pearson(shapSlice, otherSlice));
    }
    scores[j] = sum / windowCount;
  }
  return scores;
}

export function strongestInteraction(
  featureIndex: number,
  values: number[][],
  data: number[][],
): { index: number; score: number } | null {
  const scores = interactionScores(featureIndex, values, data);
  let best = -1;
  let bestScore = 0;
  scores.forEach((score, index) => {
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best === -1 ? null : { index: best, score: bestScore };
}

/**
 * Which other Feature interacts most with a given one — SHAP's
 * `approximate_interactions` (shap/utils/_general.py), ported.
 *
 * The method: sort Samples by the target Feature's value, walk them in fixed
 * windows, and sum |Pearson r| between each window's other-Feature values and
 * the correspondingly sorted SHAP values of the target. A Feature whose value
 * tracks the target's SHAP value within local neighbourhoods scores high.
 *
 * One deliberate change from SHAP. SHAP returns the raw sum, which grows with
 * the number of windows and so cannot be compared across Model outputs of
 * different size; this divides by the window count, giving a mean |r| in 0–1
 * that the chart can show and threshold on. SHAP also scores a missing-value
 * indicator and takes the larger of the two — the payload contract forbids NaN,
 * so that branch is dropped rather than ported dead.
 */

import { pearson } from "./stats";

const MAX_WINDOW = 50;

/** SHAP's `inc`: max(min(floor(n / 10), 50), 1). */
export function interactionWindowSize(sampleCount: number): number {
  return Math.max(Math.min(Math.floor(sampleCount / 10), MAX_WINDOW), 1);
}

function eligibleInteractionFeature(column: number[]): boolean {
  return column.some((value) => Math.abs(value) >= 1e-8)
    && column.some((value) => value !== column[0]);
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
    if (!eligibleInteractionFeature(sortedOther)) continue;

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
  let bestScore = -1;
  scores.forEach((score, index) => {
    if (index === featureIndex) return;
    const column = data.map((row) => row[index]);
    if (eligibleInteractionFeature(column) && score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best === -1 ? null : { index: best, score: bestScore };
}

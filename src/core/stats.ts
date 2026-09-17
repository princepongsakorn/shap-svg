/**
 * The small statistics two charts share.
 *
 * `pearson` had a second, identical copy inside the embedding layout; a
 * correlation is a correlation, and one of them drifting from the other would
 * be a silent divergence between the interaction score and the axis-meaning
 * line that both report to a reader as `r`.
 */

/** Pearson's r, or 0 when either series has no variance. */
export function pearson(a: number[], b: number[]): number {
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

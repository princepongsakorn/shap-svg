/**
 * Bracket coordinates for a dendrogram whose leaf order is already decided —
 * `shap.plots._utils.dendrogram_coords`, ported.
 *
 * SciPy can compute these, but only for the leaf order it chooses itself. The
 * bar chart orders its rows by importance relaxed towards the tree, so the
 * positions have to be supplied.
 *
 * Each merge is one bracket: up from the left child, across at the merge
 * height, down to the right child.
 */

export type DendrogramSegment = {
  /** Along the rows: left, left, right, right. */
  xs: [number, number, number, number];
  /** Merge heights: child, merge, merge, child. */
  ys: [number, number, number, number];
};

export function dendrogramCoords(
  leafPositions: number[],
  linkage: number[][],
): DendrogramSegment[] {
  if (linkage.length === 0) return [];
  const leafCount = linkage.length + 1;
  const out: DendrogramSegment[] = [];

  /** Returns the anchor (position, height) the parent bracket hangs from. */
  const walk = (node: number): [number, number] => {
    if (node < leafCount) return [leafPositions[node], 0];

    const row = linkage[node - leafCount];
    const [leftX, leftY] = walk(row[0]);
    const [rightX] = walk(row[1]);
    const height = row[2];

    out.push({
      xs: [leftX, leftX, rightX, rightX],
      ys: [leftY, height, height, height],
    });
    return [(leftX + rightX) / 2, height];
  };

  walk(leafCount + linkage.length - 1);
  return out;
}

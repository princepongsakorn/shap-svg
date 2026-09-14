import { DisplayRow, DisplayRows } from "./types";
import { formatFeatureLabel } from "./format";
import { PlotLabels, shapLabels } from "./labels";

/**
 * Spec 3.4. `faithfulOtherRow` reproduces shap/plots/_bar.py:228-241, where the last displayed row
 * absorbs the Feature ranked `maxDisplay` — so maxDisplay=15 shows 14 real Features. The default
 * corrected mode shows `maxDisplay` real Features and adds the Other features row alongside.
 */
export function collapseToDisplay(
  featureNames: string[],
  importance: number[],
  order: number[],
  maxDisplay: number,
  faithfulOtherRow: boolean,
  labels: PlotLabels = shapLabels,
): DisplayRows {
  const p = order.length;

  if (maxDisplay >= p) {
    return {
      rows: order.map((index) => ({
        label: formatFeatureLabel(featureNames[index]),
        featureIndex: index,
        value: importance[index],
        isOtherRow: false,
      })),
      collapsedCount: 0,
    };
  }

  const realCount = faithfulOtherRow ? maxDisplay - 1 : maxDisplay;
  const rows: DisplayRow[] = order.slice(0, realCount).map((index) => ({
    label: formatFeatureLabel(featureNames[index]),
    featureIndex: index,
    value: importance[index],
    isOtherRow: false,
  }));

  const collapsed = order.slice(realCount);
  const collapsedValue = collapsed.reduce((sum, index) => sum + importance[index], 0);
  rows.push({
    label: labels.otherFeatures(collapsed.length, faithfulOtherRow ? "sum" : "count"),
    featureIndex: null,
    value: collapsedValue,
    isOtherRow: true,
  });

  return { rows, collapsedCount: collapsed.length };
}

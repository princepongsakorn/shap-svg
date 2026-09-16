import { ParsedExplanation } from "./types";
import { ScatterSplit } from "./scatterLayout";
import { ForceLayout } from "./forceLayout";
import { DecisionLayout } from "./decisionLayout";
import { EmbeddingLayout } from "./embeddingLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "./format";
import { PlotLabels } from "./labels";

/**
 * A chart's own numbers, as a table.
 *
 * A matplotlib PNG is opaque to a screen reader, to text search, and to anyone
 * trying to recover a number from a figure. Every new chart publishes the rows
 * it drew, and the React layer puts them in a real <table> beside the SVG.
 */
export type ChartTable = { caption: string; columns: string[]; rows: string[][] };

const sampleName = (parsed: ParsedExplanation, index: number, words: PlotLabels) =>
  parsed.sampleLabels?.[index] ?? words.sampleFallback(index + 1);

export function scatterTableRows(
  parsed: ParsedExplanation,
  featureIndex: number,
  split: ScatterSplit,
  words: PlotLabels,
): ChartTable {
  const featureName = formatFeatureLabel(parsed.featureNames[featureIndex]);
  const rows = [...split.absent, ...split.detected]
    .sort((a, b) => a.sampleIndex - b.sampleIndex)
    .map((point) => [
      sampleName(parsed, point.sampleIndex, words),
      point.value > 0 ? formatLevel(point.value) : words.absent,
      formatShapValue(point.shap),
    ]);
  return {
    caption: words.tableCaption,
    columns: ["Sample", featureName, words.shapValue],
    rows,
  };
}

export function embeddingTableRows(
  layout: EmbeddingLayout,
  parsed: ParsedExplanation,
  words: PlotLabels,
): ChartTable {
  return {
    caption: words.tableCaption,
    columns: ["Sample", layout.xTitle, layout.yTitle],
    rows: layout.points.map((point) => [
      sampleName(parsed, point.sampleIndex, words),
      formatLevel(point.cx),
      formatLevel(point.cy),
    ]),
  };
}

export function decisionTableRows(
  layout: DecisionLayout,
  parsed: ParsedExplanation,
  words: PlotLabels,
): ChartTable {
  return {
    caption: words.tableCaption,
    columns: [
      "Sample",
      words.baseValue,
      ...layout.rowLabels.map(formatFeatureLabel),
    ],
    rows: layout.paths.map((path) => [
      sampleName(parsed, path.sampleIndex, words),
      ...path.values.map((value) => formatLevel(value)),
    ]),
  };
}

export function forceTableRows(layout: ForceLayout, words: PlotLabels): ChartTable {
  return {
    caption: words.tableCaption,
    columns: ["Feature", words.shapValue],
    rows: layout.segments.map((segment) => [
      formatFeatureLabel(segment.label),
      formatShapValue(segment.value),
    ]),
  };
}

import { ParsedExplanation } from "./types";
import { sampleDisplayName } from "./parse";
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
export type TableCell = string | { text: string; italic?: boolean };

export type ChartTable = { caption: string; columns: TableCell[]; rows: TableCell[][] };

/** A taxon's name, which is italic here as it is everywhere else. */
const taxon = (name: string): TableCell => ({ text: formatFeatureLabel(name), italic: true });


export function scatterTableRows(
  parsed: ParsedExplanation,
  featureIndex: number,
  split: ScatterSplit,
  words: PlotLabels,
): ChartTable {
  const featureName = taxon(parsed.featureNames[featureIndex]);
  const rows = [...split.absent, ...split.detected]
    .sort((a, b) => a.sampleIndex - b.sampleIndex)
    .map((point) => [
      sampleDisplayName(parsed, point.sampleIndex, words),
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
      sampleDisplayName(parsed, point.sampleIndex, words),
      formatLevel(point.coordinates[0]),
      formatLevel(point.coordinates[1]),
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
    columns: ["Sample", words.baseValue, ...layout.rowLabels.map(taxon)],
    rows: layout.paths.map((path) => [
      sampleDisplayName(parsed, path.sampleIndex, words),
      ...path.values.map((value) => formatLevel(value)),
    ]),
  };
}

export function forceTableRows(layout: ForceLayout, words: PlotLabels): ChartTable {
  return {
    caption: words.tableCaption,
    columns: ["Feature", words.shapValue],
    rows: layout.segments.map((segment) => [
      // The Other features row is a count, not a taxon, so it stays upright.
      segment.isOtherRow ? segment.label : taxon(segment.label),
      formatShapValue(segment.value),
    ]),
  };
}

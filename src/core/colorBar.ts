import { ColormapName, sampleColormap } from "./colormap";

/** fig.colorbar(..., aspect=80) in both _beeswarm.py:481 and _heatmap.py:184. */
const ASPECT = 80;
/** matplotlib's ytick.major.pad: the gap between a bar and its tick labels, in pt. */
const TICK_PAD = 3.5;
/** cb.ax.tick_params(labelsize=11), _beeswarm.py:484 and _heatmap.py:189. */
const TICK_LABEL_PT = 11;
/** cb.set_label(..., size=12), _beeswarm.py:483 and _heatmap.py:188. */
const LABEL_PT = 12;
/**
 * The rotated label's thickness and where its baseline sits inside it, in ems.
 * Measured from shap 0.49.1's own figures: an 18 px band for 12 pt text at 100 dpi.
 */
const LABEL_THICKNESS_EM = 1.08;
const LABEL_BASELINE_EM = 0.84;
/** Average advance of a character, in ems; no text is measured in the layout. */
const CHAR_EM = 0.6;
const STEPS = 64;

export type ColorBarSpec = {
  colormap: ColormapName;
  /** The labels at the bottom and top ends of the bar. */
  tickLabels: [string, string];
  /** matplotlib's offset text ("1e−5"), when the tick labels are scaled. */
  offsetText?: string;
  label: string;
  /**
   * The title broken into runs, so the part that names a taxon can be set in
   * italics as species names are everywhere else in this package. A taxon's
   * name sits in the middle of the title, not at its start, so a prefix would
   * not do. Omitted, the title is drawn as the single string `label` is.
   */
  labelParts?: { text: string; italic?: boolean }[];
  /** set_label's labelpad, in pt: 0 for the beeswarm, -10 for the heatmap. */
  labelPad: number;
};

export type ColorBarStep = { y: number; height: number; color: string };
export type ColorBarTick = { y: number; label: string };

export type ColorBarGeometry = {
  x: number;
  y1: number;
  y2: number;
  width: number;
  /** The colour map from bottom to top, as stacked bands. */
  steps: ColorBarStep[];
  tickX: number;
  tickFontSize: number;
  ticks: ColorBarTick[];
  offsetText?: { x: number; y: number; text: string };
  /** Drawn rotated -90° about (x, y), reading bottom to top. */
  label: {
    x: number;
    y: number;
    text: string;
    parts?: { text: string; italic?: boolean }[];
    fontSize: number;
  };
  /** Right edge of everything the bar draws. */
  right: number;
};

function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_EM;
}

function tickColumnWidth(spec: ColorBarSpec): number {
  return Math.max(...spec.tickLabels.map((label) => textWidth(label, TICK_LABEL_PT)));
}

/** How far right of its own left edge a bar of this height draws. */
export function colorBarExtent(height: number, spec: ColorBarSpec): number {
  return (
    height / ASPECT +
    TICK_PAD +
    Math.max(0, tickColumnWidth(spec) + spec.labelPad) +
    LABEL_PT * LABEL_THICKNESS_EM
  );
}

/**
 * Width of the plot once a colour bar beside it has room.
 *
 * matplotlib's colorbar pad is a fraction of the axes it steals from, so the gap
 * grows with the plot; `minGap` keeps it clear of anything drawn between the two,
 * such as the heatmap's side bars. When the right margin cannot hold the bar, the
 * plot gives up the difference rather than the bar being clipped.
 */
export function fitColorBar(opts: {
  plotWidth: number;
  available: number;
  gapRatio: number;
  minGap: number;
  extent: number;
}): { plotWidth: number; gap: number } {
  const { plotWidth, available, gapRatio, minGap, extent } = opts;
  const gapFor = (width: number) => Math.max(gapRatio * width, minGap);
  if (gapFor(plotWidth) + extent <= available) {
    return { plotWidth, gap: gapFor(plotWidth) };
  }
  // Solve gap(w) + extent = available + (plotWidth - w) on whichever branch of
  // gap(w) holds at the answer.
  const byRatio = (available + plotWidth - extent) / (1 + gapRatio);
  const fitted = Math.max(
    0,
    gapRatio * byRatio >= minGap ? byRatio : plotWidth - (minGap + extent - available),
  );
  return { plotWidth: fitted, gap: gapFor(fitted) };
}

/** Places a vertical colour bar with its left edge at `x`, spanning y1 (top) to y2. */
export function colorBarLayout(
  spec: ColorBarSpec,
  position: { x: number; y1: number; y2: number },
): ColorBarGeometry {
  const { x, y1, y2 } = position;
  const width = (y2 - y1) / ASPECT;
  const step = (y2 - y1) / STEPS;
  const steps = Array.from({ length: STEPS }, (_, index): ColorBarStep => ({
    y: y2 - (index + 1) * step,
    // Every band but the lowest reaches half a pixel into the one below, so
    // anti-aliasing cannot open a hairline seam between them.
    height: index === 0 ? step : step + 0.5,
    color: sampleColormap(spec.colormap, index / (STEPS - 1)),
  }));

  const tickX = x + width + TICK_PAD;
  const labelLeft = tickX + tickColumnWidth(spec) + spec.labelPad;
  return {
    x,
    y1,
    y2,
    width,
    steps,
    tickX,
    tickFontSize: TICK_LABEL_PT,
    ticks: [
      { y: y2, label: spec.tickLabels[0] },
      { y: y1, label: spec.tickLabels[1] },
    ],
    ...(spec.offsetText
      ? { offsetText: { x: tickX, y: y1 - TICK_LABEL_PT, text: spec.offsetText } }
      : {}),
    label: {
      x: labelLeft + LABEL_PT * LABEL_BASELINE_EM,
      y: (y1 + y2) / 2,
      text: spec.label,
      ...(spec.labelParts ? { parts: spec.labelParts } : {}),
      fontSize: LABEL_PT,
    },
    right: Math.max(
      tickX + tickColumnWidth(spec),
      labelLeft + LABEL_PT * LABEL_THICKNESS_EM,
    ),
  };
}

const MINUS = "−";
/** axes.formatter.limits: scientific notation outside 1e-5 .. 1e6. */
const POWER_LIMITS: [number, number] = [-5, 6];

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Tick labels as matplotlib's ScalarFormatter writes them for a fixed set of
 * ticks: the decimals are the fewest that keep every tick exact to a thousandth
 * of the tick range, and the minus sign is U+2212. Ticks outside the power
 * limits are scaled, with the scale returned as matplotlib's offset text.
 */
export function scalarFormatterLabels(locs: number[]): { labels: string[]; offsetText?: string } {
  const largest = Math.max(0, ...locs.map(Math.abs));
  const magnitude = largest === 0 ? 0 : Math.floor(Math.log10(largest));
  const order = magnitude <= POWER_LIMITS[0] || magnitude >= POWER_LIMITS[1] ? magnitude : 0;
  const scaled = locs.map((value) => value / 10 ** order);

  let range = Math.max(...scaled) - Math.min(...scaled);
  if (range === 0) range = Math.max(...scaled.map(Math.abs));
  if (range === 0) range = 1;
  const rangeMagnitude = Math.floor(Math.log10(range));
  const threshold = 1e-3 * 10 ** rangeMagnitude;
  let decimals = Math.max(0, 3 - rangeMagnitude);
  while (decimals >= 0) {
    const error = Math.max(...scaled.map((value) => Math.abs(value - roundTo(value, decimals))));
    if (error < threshold) decimals -= 1;
    else break;
  }
  decimals += 1;

  const labels = scaled.map((value) => {
    const text = value.toFixed(decimals);
    return Number(text) === 0 ? text.replace("-", "") : text.replace("-", MINUS);
  });
  return order === 0
    ? { labels }
    : { labels, offsetText: `1e${String(order).replace("-", MINUS)}` };
}

/**
 * A colour-scale title split into runs, with a taxon's name italic.
 *
 * Two charts build the same title the same way — the scatter over the Feature
 * it colours by, the embedding over the Feature whose SHAP value it colours by
 * — and a taxon's name sits in the middle of the title, not at its start, so a
 * prefix would not do. Returns undefined when the name is not in the title, in
 * which case the caller draws the title as one string.
 */
export function colorScaleTitleParts(
  title: string,
  taxon: string,
): { text: string; italic?: boolean }[] | undefined {
  const at = title.indexOf(taxon);
  if (at < 0) return undefined;
  return [
    { text: title.slice(0, at) },
    { text: taxon, italic: true },
    { text: title.slice(at + taxon.length) },
  ];
}

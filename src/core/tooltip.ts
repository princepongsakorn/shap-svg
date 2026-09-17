/**
 * Average advance of one glyph, by text size. Widths are estimated, never
 * measured: measuring needs a DOM, and these charts render on the server too.
 *
 * `body` is the 11-12px text of hover boxes and segment labels; `axis` is the
 * 11px of tick labels, which sit tighter because they are mostly digits.
 */
export const GLYPH_PX = { body: 6.5, axis: 5.6 } as const;
const PADDING_X = 7;
/** Gap between the pointer and the box. */
const OFFSET = 8;
/** How far above the pointer the box starts, so its first line sits level with it. */
const RAISE = 24;

export type TooltipBox = { x: number; y: number; width: number; height: number };

/**
 * Where a hover box goes: right of the point, flipped to its left when the
 * chart's right edge would cut it off, and kept inside the chart top to bottom.
 * Its width follows the longest line, so a long taxon name or a long label
 * stays inside the box.
 */
export function placeTooltip(opts: {
  anchorX: number;
  anchorY: number;
  lines: string[];
  lineHeight: number;
  minWidth: number;
  chartWidth: number;
  chartHeight: number;
}): TooltipBox {
  const { anchorX, anchorY, lines, lineHeight, minWidth, chartWidth, chartHeight } = opts;
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(minWidth, longest * GLYPH_PX.body + 2 * PADDING_X);
  const height = lines.length * lineHeight + lineHeight * 0.6;

  const right = anchorX + OFFSET;
  const x = right + width <= chartWidth ? right : Math.max(0, anchorX - OFFSET - width);
  const y = Math.max(0, Math.min(anchorY - RAISE, chartHeight - height));
  return { x, y, width, height };
}


/**
 * A run of a hover-box line.
 *
 * A line such as `Fusobacterium nucleatum: 1e-4` needs the taxon's name in
 * italics and the number upright, so it cannot be one string with one style.
 * Every chart's hover box builds lines out of these.
 */
export type TooltipRun = { text: string; italic?: boolean };

/** The plain text of a line — for width estimates, aria text and tests. */
export const runsToText = (runs: TooltipRun[]): string => runs.map((run) => run.text).join("");

/** A taxon's name and a value, the name italic as a scientific name always is. */
export const namedValue = (name: string, value: string): TooltipRun[] => [
  { text: name, italic: true },
  { text: `: ${value}` },
];

/** Height of one line of a hover box, shared so every chart's box lines up. */
export const TOOLTIP_LINE_HEIGHT = 15;

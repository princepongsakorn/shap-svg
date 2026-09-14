/** Average advance of one glyph of the 11 px tooltip text. Widths are estimated, never measured. */
const CHAR_PX = 6.5;
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
  const width = Math.max(minWidth, longest * CHAR_PX + 2 * PADDING_X);
  const height = lines.length * lineHeight + lineHeight * 0.6;

  const right = anchorX + OFFSET;
  const x = right + width <= chartWidth ? right : Math.max(0, anchorX - OFFSET - width);
  const y = Math.max(0, Math.min(anchorY - RAISE, chartHeight - height));
  return { x, y, width, height };
}

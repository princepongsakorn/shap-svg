import { TooltipBox, TooltipRun, TOOLTIP_LINE_HEIGHT } from "../core/tooltip";

/** Inset of the text from the box's own edge. */
const PADDING_X = 7;
/** Baseline of the first line inside the box. */
const FIRST_BASELINE = 16;

/**
 * The hover box every chart draws.
 *
 * Four charts had a verbatim copy of this markup, which is four places for a
 * padding or a colour to drift. `placeTooltip` decides where the box goes; this
 * only draws it. Lines arrive as runs so a taxon's name can be italic inside a
 * line that also carries a number.
 */
export function HoverBox({ box, lines }: { box: TooltipBox; lines: TooltipRun[][] }) {
  if (lines.length === 0) return null;
  return (
    <g pointerEvents="none" transform={`translate(${box.x} ${box.y})`}>
      <rect x={0} y={0} width={box.width} height={box.height} rx={3}
            fill="#ffffff" stroke="#cccccc" />
      {lines.map((line, index) => (
        <text key={`line-${index}`} x={PADDING_X} y={FIRST_BASELINE + index * TOOLTIP_LINE_HEIGHT}
              fontSize={11} fill="#222222">
          {line.map((run, runIndex) => (
            <tspan key={`run-${runIndex}`} fontStyle={run.italic ? "italic" : undefined}>
              {run.text}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  );
}

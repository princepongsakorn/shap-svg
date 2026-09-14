import { MouseEvent as ReactMouseEvent, useMemo, useState } from "react";
import { beeswarmLayout, beeswarmRows } from "../core/beeswarmLayout";
import { formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { placeTooltip } from "../core/tooltip";
import { ColorBar } from "./ColorBar";
import { XAxis } from "./XAxis";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { RowSort } from "../core/rowSort";
import { Explanation } from "../core/types";

export type ShapBeeswarmProps = {
  explanation: Explanation;
  maxDisplay?: number;
  faithfulOtherRow?: boolean;
  /** Collapse `Genus_species` Features into their genus before drawing. */
  groupByGenus?: boolean;
  /** Order of the displayed rows. Never changes which rows are shown. */
  rowSort?: RowSort;
  classIndex?: number;
  width?: number;
  rowHeight?: number;
  seed?: number;
  dotRadius?: number;
  /** SHAP's Low–High feature value colour bar, as color_bar=True draws it. */
  colorBar?: boolean;
  /**
   * Wording for every piece of text the chart draws; keys not given keep SHAP's.
   * Pass a stable object (a module constant or a memo): a new one each render
   * recomputes the layout each render.
   */
  labels?: Partial<PlotLabels>;
  onFeatureClick?: (featureIndex: number | null) => void;
};

type HoveredPoint = { rowIndex: number; pointIndex: number };

export function ShapBeeswarm({
  explanation,
  maxDisplay = 10,
  faithfulOtherRow = false,
  groupByGenus = false,
  rowSort = "importance",
  classIndex = 1,
  width = 720,
  rowHeight = 28,
  seed = 0,
  dotRadius = 3,
  colorBar = true,
  labels,
  onFeatureClick,
}: ShapBeeswarmProps) {
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);
  const marginTop = 8;

  const layout = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const rows = beeswarmRows(parsed, maxDisplay, faithfulOtherRow, seed, rowSort, words);
    return beeswarmLayout(rows, {
      width,
      rowHeight,
      marginLeft: 260,
      marginRight: 90,
      marginTop,
      dotRadius,
      colorBar,
      labels: words,
    });
  }, [groupByGenus, rowSort, colorBar, words,
    explanation,
    maxDisplay,
    faithfulOtherRow,
    classIndex,
    width,
    rowHeight,
    seed,
    dotRadius,
  ]);

  const handlePointHover = (rowIndex: number, event: ReactMouseEvent<SVGGElement>) => {
    const attribute = (event.target as Element).getAttribute?.("data-point-index");
    if (attribute === null || attribute === undefined) return;
    const pointIndex = Number(attribute);
    if (Number.isInteger(pointIndex)) setHovered({ rowIndex, pointIndex });
  };

  const fallbackRow = layout.rows[0];
  const activeRow = hovered ? layout.rows[hovered.rowIndex] : fallbackRow;
  const activePoint = hovered
    ? activeRow?.points[hovered.pointIndex]
    : activeRow?.points[0];
  const tooltipLines = activeRow && activePoint
    ? [
        activeRow.label,
        `${words.shapValue}: ${formatShapValue(activePoint.valueX)}`,
        // Unsigned: a feature value is an input, not a push in either direction.
        `${words.featureValue}: ${Number.isFinite(activePoint.featureValue)
          ? formatLevel(activePoint.featureValue)
          : words.missingFeatureValue}`,
      ]
    : [];
  const tooltip = activePoint
    ? placeTooltip({
        anchorX: activePoint.x,
        anchorY: activePoint.y,
        lines: tooltipLines,
        lineHeight: 15,
        minWidth: 160,
        chartWidth: width,
        chartHeight: layout.height,
      })
    : null;

  return (
    <svg
      width={width}
      height={layout.height}
      role="img"
      aria-label={`${words.shapValue} of each feature, for every sample`}
    >
      <line
        x1={layout.xZero}
        x2={layout.xZero}
        y1={marginTop}
        y2={layout.plotBottom}
        stroke="#777777"
        strokeWidth={1}
      />

      {layout.rows.map((row, rowIndex) => (
        <g
          key={`row-${rowIndex}`}
          onMouseOver={(event) => handlePointHover(rowIndex, event)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onFeatureClick?.(row.featureIndex)}
          style={{ cursor: onFeatureClick ? "pointer" : "default" }}
        >
          <rect
            x={0}
            y={row.centerY - rowHeight / 2}
            width={width}
            height={rowHeight}
            fill={hovered?.rowIndex === rowIndex ? "#00000008" : "transparent"}
          />
          <text
            x={250}
            y={row.centerY}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={13}
            fill="#333333"
            fontStyle={row.isOtherRow ? "normal" : "italic"}
          >
            {row.label}
          </text>
          {row.points.map((point, pointIndex) => (
            <circle
              key={`point-${point.sampleIndex}`}
              data-point-index={pointIndex}
              cx={point.x}
              cy={point.y}
              r={point.radius}
              fill={point.color}
              fillOpacity={0.7}
            />
          ))}
        </g>
      ))}

      <XAxis
        ticks={layout.xTicks}
        spine={layout.xSpine}
        title={layout.xTitle}
        plotBottom={layout.plotBottom}
        tickFontSize={11}
      />

      {layout.colorBar && <ColorBar bar={layout.colorBar} />}

      {tooltip && (
        <g
          opacity={hovered ? 1 : 0}
          pointerEvents="none"
          transform={`translate(${tooltip.x} ${tooltip.y})`}
        >
          <rect
            x={0}
            y={0}
            width={tooltip.width}
            height={tooltip.height}
            rx={3}
            fill="#ffffff"
            stroke="#cccccc"
          />
          {tooltipLines.map((line, index) => (
            <text key={`tooltip-${index}`} x={7} y={16 + index * 15} fontSize={11} fill="#222222">
              {line}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

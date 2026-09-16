import { ColorBarGeometry } from "../core/colorBar";

/**
 * A vertical colour bar the way matplotlib draws SHAP's: no outline, no tick
 * marks, a label at each end, and the title rotated to read bottom to top.
 */
export function ColorBar({ bar }: { bar: ColorBarGeometry }) {
  return (
    <g role="img" aria-label={`${bar.label.text}: ${bar.ticks[0].label} to ${bar.ticks[1].label}`}>
      {bar.steps.map((step, index) => (
        <rect
          key={`colorbar-step-${index}`}
          x={bar.x}
          y={step.y}
          width={bar.width}
          height={step.height}
          fill={step.color}
        />
      ))}
      {bar.ticks.map((tick, index) => (
        <text
          key={`colorbar-tick-${index}`}
          x={bar.tickX}
          y={tick.y}
          dominantBaseline="middle"
          fontSize={bar.tickFontSize}
          fill="#333333"
        >
          {tick.label}
        </text>
      ))}
      {bar.offsetText && (
        <text
          x={bar.offsetText.x}
          y={bar.offsetText.y}
          fontSize={bar.tickFontSize}
          fill="#333333"
        >
          {bar.offsetText.text}
        </text>
      )}
      <text
        x={bar.label.x}
        y={bar.label.y}
        transform={`rotate(-90 ${bar.label.x} ${bar.label.y})`}
        textAnchor="middle"
        fontSize={bar.label.fontSize}
        fill="#333333"
      >
        {bar.label.parts
          ? bar.label.parts.map((part, index) => (
              <tspan key={`label-part-${index}`} fontStyle={part.italic ? "italic" : undefined}>
                {part.text}
              </tspan>
            ))
          : bar.label.text}
      </text>
    </g>
  );
}

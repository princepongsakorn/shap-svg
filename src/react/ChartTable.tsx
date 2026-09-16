import type { CSSProperties } from "react";
import { ChartTable as ChartTableData } from "../core/tableRows";
import { TableView } from "../core/types";

/** Clips the table to a 1px box without hiding it from assistive technology. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function ChartTable({ data, view }: { data: ChartTableData; view: TableView }) {
  if (view === "none") return null;
  return (
    <table style={view === "hidden" ? VISUALLY_HIDDEN : undefined}>
      <caption>{data.caption}</caption>
      <thead>
        <tr>
          {data.columns.map((column) => (
            <th key={column} scope="col">{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={`row-${i}`}>
            {row.map((cell, j) =>
              j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>,
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import type { CSSProperties } from "react";
import { ChartTable as ChartTableData, TableCell } from "../core/tableRows";
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

/** A cell's text, italic when it names a taxon. */
function Cell({ cell }: { cell: TableCell }) {
  if (typeof cell === "string") return <>{cell}</>;
  return cell.italic ? <em>{cell.text}</em> : <>{cell.text}</>;
}

export function ChartTable({ data, view }: { data: ChartTableData; view: TableView }) {
  if (view === "none") return null;
  return (
    <table style={view === "hidden" ? VISUALLY_HIDDEN : undefined}>
      <caption>{data.caption}</caption>
      <thead>
        <tr>
          {data.columns.map((column, index) => (
            <th key={`column-${index}`} scope="col">
              <Cell cell={column} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={`row-${i}`}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row"><Cell cell={cell} /></th>
              ) : (
                <td key={j}><Cell cell={cell} /></td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

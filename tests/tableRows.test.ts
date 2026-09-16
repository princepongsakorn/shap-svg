import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { resolveLabels } from "../src/core/labels";
import { scatterPoints } from "../src/core/scatterLayout";
import { forceLayout } from "../src/core/forceLayout";
import { decisionLayout } from "../src/core/decisionLayout";
import { decisionTableRows, forceTableRows, scatterTableRows } from "../src/core/tableRows";

const parsed = parseExplanation({
  contract_version: 1,
  values: [[0.3, -0.1], [-0.2, 0.05]],
  base_values: 0.5,
  data: [[0, 2], [0.4, 3]],
  feature_names: ["Fusobacterium_nucleatum", "b"],
});
const words = resolveLabels();

describe("scatterTableRows", () => {
  it("has one row per Sample", () => {
    const table = scatterTableRows(parsed, 0, scatterPoints(parsed, 0), words);
    expect(table.rows).toHaveLength(2);
  });

  it("writes an absent Sample's abundance as the Absent word, not as 0", () => {
    const table = scatterTableRows(parsed, 0, scatterPoints(parsed, 0), words);
    const absentRow = table.rows.find((r) => r[0] === "Sample 1");
    expect(absentRow?.[1]).toBe("Absent");
  });

  it("names its columns", () => {
    const table = scatterTableRows(parsed, 0, scatterPoints(parsed, 0), words);
    expect(table.columns).toEqual(["Sample", "Fusobacterium nucleatum", "SHAP value"]);
  });
});

describe("forceTableRows", () => {
  it("has one row per drawn segment", () => {
    const layout = forceLayout({ parsed, sampleIndex: 0, width: 400, height: 90, maxDisplay: 2 });
    expect(forceTableRows(layout, words).rows).toHaveLength(layout.segments.length);
  });
});

describe("decisionTableRows", () => {
  it("ends each Sample's row at its Model output", () => {
    const layout = decisionLayout({ parsed, width: 400, rowHeight: 20, maxDisplay: 2 });
    const table = decisionTableRows(layout, parsed, words);
    expect(table.rows[0][table.rows[0].length - 1]).toBe("0.7");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { decisionLayout } from "../src/core/decisionLayout";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

const toGoldenPrecision = (value: number) => Number(value.toPrecision(4));

function expectGoldenNumber(actual: number, expected: number): void {
  const roundedActual = toGoldenPrecision(actual);
  const roundedExpected = toGoldenPrecision(expected);
  const tolerance = Math.max(Math.abs(roundedExpected) * 1e-3, 1e-6);
  expect(Math.abs(roundedActual - roundedExpected)).toBeLessThanOrEqual(tolerance);
}

describe.each(["tiny", "real"])("decision golden values — %s", (name) => {
  const parsed = parseExplanation(load(`${name}.json`));
  const golden = load(`${name}.decision.golden.json`);
  const layout = decisionLayout({
    parsed, width: 720, rowHeight: 26, maxDisplay: golden.max_display,
  });

  it("draws the same rows, bottom to top", () => {
    expect(layout.rowLabels).toEqual(golden.row_labels);
  });

  it("starts each path where SHAP starts it", () => {
    layout.paths.forEach((path, i) => {
      expectGoldenNumber(path.values[0], golden.starts[i]);
    });
  });

  it("ends each path at the same Model output", () => {
    layout.paths.forEach((path, i) => {
      const goldenRow = golden.cumsum[i];
      expectGoldenNumber(path.values[path.values.length - 1], goldenRow[goldenRow.length - 1]);
    });
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { forceLayout } from "../src/core/forceLayout";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

const toGoldenPrecision = (value: number) => Number(value.toPrecision(4));

function expectGoldenNumber(actual: number, expected: number): void {
  const roundedActual = toGoldenPrecision(actual);
  const roundedExpected = toGoldenPrecision(expected);
  const tolerance = Math.max(Math.abs(roundedExpected) * 1e-3, 1e-6);
  expect(Math.abs(roundedActual - roundedExpected)).toBeLessThanOrEqual(tolerance);
}

describe.each(["tiny", "real"])("force golden values — %s", (name) => {
  const parsed = parseExplanation(load(`${name}.json`));
  const golden = load(`${name}.force.golden.json`);
  const layout = forceLayout({
    parsed,
    sampleIndex: golden.sample_index,
    width: 720,
    height: 96,
    maxDisplay: parsed.nFeatures,
  });

  it("meets at the same f(x)", () => {
    expectGoldenNumber(layout.modelOutput, golden.fx);
  });

  it("starts from the same Base value", () => {
    expectGoldenNumber(layout.baseValue, golden.base_value);
  });

  it("accounts for every contribution, to within rounding", () => {
    const drawn = layout.segments.reduce((sum, s) => sum + s.value, 0);
    const expected = (golden.contributions as number[]).reduce((sum, v) => sum + v, 0);
    expectGoldenNumber(drawn, expected);
  });
});

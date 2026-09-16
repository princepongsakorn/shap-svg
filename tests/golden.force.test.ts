import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { forceLayout } from "../src/core/forceLayout";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

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
    expect(layout.modelOutput).toBeCloseTo(golden.fx, 6);
  });

  it("starts from the same Base value", () => {
    expect(layout.baseValue).toBeCloseTo(golden.base_value, 6);
  });

  it("accounts for every contribution, to within rounding", () => {
    const drawn = layout.segments.reduce((sum, s) => sum + s.value, 0);
    const expected = (golden.contributions as number[]).reduce((sum, v) => sum + v, 0);
    expect(drawn).toBeCloseTo(expected, 6);
  });
});

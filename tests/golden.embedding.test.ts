import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { shapPca } from "../src/core/pca";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

/** A component is a direction: scikit-learn may return the opposite sign. */
const sameUpToSign = (ours: number[], theirs: number[]) => {
  const flip = ours[0] * theirs[0] < 0 ? -1 : 1;
  ours.forEach((value, i) => expect(value * flip).toBeCloseTo(theirs[i], 4));
};

describe.each(["tiny", "real"])("embedding golden values — %s", (name) => {
  const parsed = parseExplanation(load(`${name}.json`));
  const golden = load(`${name}.embedding.golden.json`);
  const result = shapPca(parsed.values);

  it("explains the same share of variance on each component", () => {
    expect(result.varianceRatios[0]).toBeCloseTo(golden.variance_ratios[0], 4);
    expect(result.varianceRatios[1]).toBeCloseTo(golden.variance_ratios[1], 4);
  });

  it("projects onto the same first component", () => {
    sameUpToSign(
      result.coords.map((c) => c[0]),
      (golden.coords as number[][]).map((c) => c[0]),
    );
  });

  it("projects onto the same second component", () => {
    sameUpToSign(
      result.coords.map((c) => c[1]),
      (golden.coords as number[][]).map((c) => c[1]),
    );
  });
});

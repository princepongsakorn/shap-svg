import { describe, expect, it } from "vitest";
import { interactionScores, strongestInteraction, interactionWindowSize } from "../src/core/interactions";

/** Feature 1 tracks feature 0's SHAP value exactly; feature 2 is constant. */
const data: number[][] = [];
const values: number[][] = [];
for (let i = 0; i < 40; i++) {
  data.push([i, i * 2, 7]);
  values.push([i % 2 === 0 ? i : -i, 0, 0]);
}

describe("interactionWindowSize", () => {
  it("is a tenth of the Samples, capped at 50 and floored at 1", () => {
    expect(interactionWindowSize(400)).toBe(40);
    expect(interactionWindowSize(4000)).toBe(50);
    expect(interactionWindowSize(3)).toBe(1);
  });
});

describe("interactionScores", () => {
  it("scores the target Feature zero", () => {
    expect(interactionScores(0, values, data)[0]).toBe(0);
  });

  it("scores a Feature with no variance zero", () => {
    expect(interactionScores(0, values, data)[2]).toBe(0);
  });

  it("normalises into 0–1", () => {
    for (const score of interactionScores(0, values, data)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("finds the Feature that moves with the target's SHAP value", () => {
    expect(strongestInteraction(0, values, data)?.index).toBe(1);
  });

  it("returns null when nothing else varies", () => {
    const flat = [[1, 0], [2, 0], [3, 0]];
    const flatValues = [[1, 0], [2, 0], [3, 0]];
    expect(strongestInteraction(0, flatValues, flat)).toBeNull();
  });
});

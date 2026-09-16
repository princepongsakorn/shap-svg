import { describe, expect, it } from "vitest";
import { dendrogramCoords } from "../src/core/dendrogram";

/** Leaves 0 and 1 merge at 0.2; that cluster joins leaf 2 at 0.8. */
const linkage = [
  [0, 1, 0.2, 2],
  [3, 2, 0.8, 3],
];

describe("dendrogramCoords", () => {
  it("emits one bracket per merge", () => {
    expect(dendrogramCoords([0, 1, 2], linkage)).toHaveLength(2);
  });

  it("draws each bracket as four points, up across and down", () => {
    const [first] = dendrogramCoords([0, 1, 2], linkage);
    expect(first.xs).toEqual([0, 0, 1, 1]);
    expect(first.ys).toEqual([0, 0.2, 0.2, 0.2]);
  });

  it("hangs the outer bracket from the midpoint of the inner one", () => {
    const [, outer] = dendrogramCoords([0, 1, 2], linkage);
    expect(outer.xs[0]).toBeCloseTo(0.5, 9);
    expect(outer.ys[0]).toBeCloseTo(0.2, 9);
    expect(outer.ys[1]).toBeCloseTo(0.8, 9);
  });

  it("follows the leaf positions it is given, not leaf order", () => {
    const [first] = dendrogramCoords([100, 40, 70], linkage);
    expect(first.xs).toEqual([100, 100, 40, 40]);
  });

  it("returns nothing for a single leaf", () => {
    expect(dendrogramCoords([0], [])).toEqual([]);
  });
});

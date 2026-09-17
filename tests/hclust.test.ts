import { describe, expect, it } from "vitest";
import {
  averageLinkage,
  copheneticDistances,
  correlationDistances,
  leafOrder,
  relaxSortOrder,
} from "../src/core/hclust";

/** a and b move together, c moves against them, d is unrelated. */
const columns = [
  [1, 2, 3, 4, 5],
  [2, 4, 6, 8, 10],
  [5, 4, 3, 2, 1],
  [3, 1, 4, 1, 5],
];

describe("correlationDistances", () => {
  it("is zero between perfectly correlated Features", () => {
    expect(correlationDistances(columns)[0][1]).toBeCloseTo(0, 9);
  });

  it("ignores the sign, so perfect anticorrelation is also zero", () => {
    expect(correlationDistances(columns)[0][2]).toBeCloseTo(0, 9);
  });

  it("is zero on the diagonal and symmetric off it", () => {
    const d = correlationDistances(columns);
    expect(d[3][3]).toBe(0);
    expect(d[0][3]).toBeCloseTo(d[3][0], 12);
  });

  it("calls a Feature with no variance maximally distant", () => {
    const d = correlationDistances([[1, 1, 1], [1, 2, 3]]);
    expect(d[0][1]).toBe(1);
  });
});

describe("averageLinkage", () => {
  it("emits one merge row fewer than there are leaves, each of width 4", () => {
    const linkage = averageLinkage(correlationDistances(columns));
    expect(linkage).toHaveLength(3);
    for (const row of linkage) expect(row).toHaveLength(4);
  });

  it("merges the closest pair first", () => {
    // Hand-computed: a-b and a-c are both distance 0, and ties go to the
    // lowest indices, so leaves 0 and 1 merge first.
    const [first] = averageLinkage(correlationDistances(columns));
    expect([first[0], first[1]]).toEqual([0, 1]);
    expect(first[2]).toBeCloseTo(0, 9);
    expect(first[3]).toBe(2);
  });

  it("records a growing merge height", () => {
    const linkage = averageLinkage(correlationDistances(columns));
    expect(linkage[2][2]).toBeGreaterThan(linkage[0][2]);
  });
});

describe("copheneticDistances", () => {
  it("gives each pair the height of the merge that first joined them", () => {
    const linkage = averageLinkage(correlationDistances(columns));
    const cophenetic = copheneticDistances(linkage);
    expect(cophenetic[0][1]).toBeCloseTo(linkage[0][2], 9);
    expect(cophenetic[0][0]).toBe(0);
  });
});

describe("leafOrder", () => {
  it("lists every leaf once", () => {
    const linkage = averageLinkage(correlationDistances(columns));
    const order = leafOrder(linkage, [4, 3, 2, 1]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it("puts the heavier side of each merge first", () => {
    const linkage = averageLinkage(correlationDistances(columns));
    expect(leafOrder(linkage, [1, 9, 1, 1])[0]).toBe(1);
  });
});

describe("relaxSortOrder", () => {
  it("keeps the importance order when no pair is within the cutoff", () => {
    const cophenetic = [
      [0, 9, 9],
      [9, 0, 9],
      [9, 9, 0],
    ];
    expect(relaxSortOrder(cophenetic, [2, 1, 0], 0.5, [0, 1, 2])).toEqual([0, 1, 2]);
  });

  it("pulls a close neighbour forward to sit beside its cluster", () => {
    const cophenetic = [
      [0, 9, 0.1],
      [9, 0, 9],
      [0.1, 9, 0],
    ];
    expect(relaxSortOrder(cophenetic, [0, 2, 1], 0.5, [0, 1, 2])).toEqual([0, 2, 1]);
  });
});

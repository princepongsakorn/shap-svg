import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseExplanation } from "../src/core/parse";
import { clusteredOrder, CLUSTERING_POOL } from "../src/core/barLayout";
import { globalImportance, orderFeatures } from "../src/core/order";
import { ShapBar } from "../src/react/ShapBar";

/** b is a copy of a; c is unrelated and slightly more important than b. */
const parsed = parseExplanation({
  contract_version: 1,
  values: [
    [0.5, 0.5, -0.6],
    [-0.4, -0.4, 0.7],
    [0.3, 0.3, -0.5],
    [0.2, 0.2, 0.9],
  ],
  base_values: 0.5,
  data: [[1, 1, 9], [2, 2, 3], [3, 3, 7], [4, 4, 1]],
  feature_names: ["a", "b", "c"],
});

const importanceOrder = orderFeatures(globalImportance(parsed));

describe("CLUSTERING_POOL", () => {
  it("is the 50 the design fixed", () => {
    expect(CLUSTERING_POOL).toBe(50);
  });
});

describe("clusteredOrder", () => {
  it("returns a linkage matrix of (k-1) rows of width 4", () => {
    const { linkage } = clusteredOrder({
      parsed, importanceOrder, mode: "shap", cutoff: 0.5,
    });
    expect(linkage).toHaveLength(2);
    for (const row of linkage) expect(row).toHaveLength(4);
  });

  it("pulls a redundant Feature next to its twin, ahead of a more important one", () => {
    // By importance alone c outranks b; clustering keeps a and b together.
    expect(importanceOrder).toEqual([2, 0, 1]);
    const { order } = clusteredOrder({ parsed, importanceOrder, mode: "shap", cutoff: 0.5 });
    expect(order.indexOf(1) - order.indexOf(0)).toBe(1);
  });

  it("leaves the importance order alone when the cutoff admits nothing", () => {
    const { order } = clusteredOrder({ parsed, importanceOrder, mode: "shap", cutoff: -1 });
    expect(order).toEqual(importanceOrder);
  });

  it("clusters on abundance when asked", () => {
    const { linkage } = clusteredOrder({ parsed, importanceOrder, mode: "data", cutoff: 0.5 });
    expect(linkage).toHaveLength(2);
  });

  it("accepts a linkage matrix computed elsewhere and does not recompute it", () => {
    const supplied = [[0, 1, 0.05, 2], [3, 2, 0.9, 3]];
    const { linkage } = clusteredOrder({
      parsed, importanceOrder, mode: supplied, cutoff: 0.5,
    });
    expect(linkage).toBe(supplied);
  });

  it("keeps every Feature when a supplied linkage covers only the leading pool", () => {
    const featureCount = 60;
    const many = parseExplanation({
      contract_version: 1,
      values: [Array.from({ length: featureCount }, (_, j) => featureCount - j)],
      base_values: 0,
      data: [Array.from({ length: featureCount }, (_, j) => j)],
      feature_names: Array.from({ length: featureCount }, (_, j) => `f${j}`),
    });
    const ranked = orderFeatures(globalImportance(many));
    const supplied = [[0, 1, 0.05, 2], [3, 2, 0.9, 3]];

    const { order } = clusteredOrder({ parsed: many, importanceOrder: ranked, mode: supplied, cutoff: 0.5 });

    expect(order).toHaveLength(featureCount);
    expect(new Set(order).size).toBe(featureCount);
    expect(order.slice(3)).toEqual(ranked.slice(3));
  });

  it("rejects a supplied matrix of the wrong shape", () => {
    expect(() =>
      clusteredOrder({ parsed, importanceOrder, mode: [[0, 1, 0.5]], cutoff: 0.5 }),
    ).toThrow(/4/);
  });
});

describe("ShapBar clustering", () => {
  it("draws a pooled tree when fewer Features are displayed", () => {
    const explanation = {
      contract_version: 1 as const,
      values: [Array.from({ length: 12 }, (_, j) => j + 1)],
      base_values: 0,
      data: [Array.from({ length: 12 }, (_, j) => j)],
      feature_names: Array.from({ length: 12 }, (_, j) => `f${j}`),
    };

    expect(() => renderToStaticMarkup(createElement(ShapBar, {
      explanation, clustering: "shap", maxDisplay: 5,
    }))).not.toThrow();
  });

  it("draws a dendrogram connection that crosses the display cut", () => {
    const explanation = {
      contract_version: 1 as const,
      values: [[3, 2, 1]],
      base_values: 0,
      data: [[3, 2, 1]],
      feature_names: ["a", "b", "c"],
    };
    const svg = renderToStaticMarkup(createElement(ShapBar, {
      explanation,
      clustering: [[0, 1, 0.05, 2], [3, 2, 0.9, 3]],
      maxDisplay: 2,
    }));

    expect(svg.match(/<polyline/g)).toHaveLength(2);
  });
});

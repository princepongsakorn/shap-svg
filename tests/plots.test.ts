import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as entry from "../react";

const explanation = {
  contract_version: 1,
  values: [[0.1, -0.2]],
  base_values: 0.5,
  data: [[1, 2]],
  feature_names: ["Bacteroides_dorei", "Parvimonas_micra"],
};

describe("shap-svg/react — the public entry", () => {
  it("exposes the charts under Plots, named like shap.plots in Python", () => {
    expect(Object.keys(entry.Plots).sort()).toEqual([
      "bar", "beeswarm", "embedding", "heatmap", "scatter", "waterfall",
    ]);
  });

  it("no longer exports the Shap-prefixed component names", () => {
    for (const oldName of ["ShapBar", "ShapBeeswarm", "ShapHeatmap", "ShapWaterfall"]) {
      expect(entry).not.toHaveProperty(oldName);
    }
  });

  it("renders every chart through its Plots member", () => {
    for (const [name, component] of Object.entries(entry.Plots)) {
      const props = name === "scatter" ? { explanation, feature: 0 } : { explanation };
      const svg = renderToStaticMarkup(
        createElement(component as ComponentType<typeof props>, props),
      );
      expect(svg.startsWith("<svg"), `Plots.${name}`).toBe(true);
    }
  });

  it("names each chart after how it is written, for React DevTools", () => {
    for (const [name, component] of Object.entries(entry.Plots)) {
      expect((component as { displayName?: string }).displayName).toBe(`Plots.${name}`);
    }
  });
});

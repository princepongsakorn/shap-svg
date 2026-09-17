import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  abbreviateBinomialLabel,
  forceSegmentLabel,
  ShapForce,
} from "../src/react/ShapForce";

describe("force label fitting", () => {
  it("abbreviates only two-word Feature names", () => {
    expect(abbreviateBinomialLabel("Fusobacterium_nucleatum", false)).toBe("F. nucleatum");
    expect(abbreviateBinomialLabel("Bacteroides", false)).toBeNull();
    expect(abbreviateBinomialLabel("Candidatus Bacteroides dorei", false)).toBeNull();
    expect(abbreviateBinomialLabel("213 other features", true)).toBeNull();
  });

  it("omits, abbreviates, or keeps a Feature label according to available width", () => {
    expect(forceSegmentLabel("Fusobacterium nucleatum", false, 60)).toBeNull();
    expect(forceSegmentLabel("Fusobacterium nucleatum", false, 160)).toBe(
      "Fusobacterium nucleatum",
    );
    expect(forceSegmentLabel("Fusobacterium nucleatum", false, 90)).toBe("F. nucleatum");
  });
});

describe("force annotation clamping", () => {
  it("keeps every anchored label extent inside the chart", () => {
    const width = 240;
    const svg = renderToStaticMarkup(createElement(ShapForce, {
      width,
      height: 110,
      maxDisplay: 2,
      tableView: "none",
      labels: {
        modelOutput: "Model output",
        baseValue: "Base value",
        higher: "raises",
        lower: "lowers",
      },
      explanation: {
        contract_version: 1,
        values: [[0.99, -0.01]],
        base_values: 0.2,
        data: [[1, 2]],
        feature_names: ["Fusobacterium_nucleatum", "Gemella_morbillorum"],
      },
    }));

    const textElements = [...svg.matchAll(/<text ([^>]*)>([^<]+)<\/text>/g)];
    for (const label of ["Model output 1.18", "raises", "lowers", "Base value"]) {
      const element = textElements.find((match) => match[2] === label);
      expect(element, `missing ${label}`).not.toBeUndefined();
      const x = Number(element![1].match(/x="([^"]+)"/)?.[1]);
      const anchor = element![1].match(/text-anchor="([^"]+)"/)?.[1];
      const textWidth = label.length * 6.5;
      const left = anchor === "middle" ? x - textWidth / 2 : anchor === "end" ? x - textWidth : x;
      const right = anchor === "middle" ? x + textWidth / 2 : anchor === "end" ? x : x + textWidth;
      expect(left, `${label} left extent`).toBeGreaterThanOrEqual(0);
      expect(right, `${label} right extent`).toBeLessThanOrEqual(width);
    }
  });
});

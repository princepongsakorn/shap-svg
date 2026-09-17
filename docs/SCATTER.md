# `Plots.scatter`

## What it answers

How does one Feature's value relate to its SHAP value across Samples? The chart separates Samples
where the Feature is absent, plots detected Samples on a logarithmic axis by default, and can colour
them by the strongest detected interaction.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `explanation` | — | the SHAP explanation payload |
| `feature` | — | Feature name or zero-based index to draw |
| `colorFeature` | `"auto"` | Feature name or index for colour, `"auto"` for interaction detection, or `"none"` |
| `colorFeatureMinScore` | `0.2` | minimum normalised interaction score used by automatic colour selection |
| `xScale` | `"log"` | `"log"` or `"linear"`; log falls back to linear when detected values are not positive |
| `trend` | `true` | draw the binned-median dose–response trend over detected Samples |
| `groupByGenus` | `false` | use the Genus view instead of the Species view |
| `classIndex` | `1` | output to draw from a multi-output explanation |
| `width` | `640` | SVG width in pixels |
| `height` | `400` | SVG height in pixels |
| `colormap` | `"red_blue"` | `"red_blue"` or the neutral-midpoint `"red_white_blue"` |
| `tableView` | `"hidden"` | `"hidden"`, `"visible"`, or `"none"` |
| `labels` | SHAP wording | partial [`PlotLabels`](../README.md#wording) override |
| `onSampleClick` | — | called with the zero-based Sample index |

## Differences from SHAP

- SHAP's `_scatter.py` takes the first result from `approximate_interactions` when interaction
  colouring is automatic. This chart displays the corresponding score after normalising it into
  0–1, and declines to colour below `colorFeatureMinScore`, so a Feature selected from noise does not
  look as authoritative as a real interaction.
- `_scatter.py` does not draw a dose–response summary. `trend` adds a binned median over detected
  Samples only, leaving the separate absent band out of the estimate.
- The Genus view is available through `groupByGenus`; the Species view remains the default.
- `tableView` keeps the chart's numbers in a real table for screen readers and text search. A
  matplotlib image produced by `_scatter.py` cannot provide that access.
- `red_blue` remains the default for fidelity. `red_white_blue` is available because the SHAP
  `red_blue` table used by `_scatter.py` is darkest at its midpoint: OKLab lightness 0.512, versus
  0.636 and 0.635 at the poles. The alternative gives a zero contribution a neutral midpoint.

## Minimal usage

```tsx
import { Plots } from "shap-svg/react";

<Plots.scatter explanation={explanation} feature="Bacteroides_dorei" />;
```

# `Plots.decision`

## What it answers

How do Features cumulatively move multiple Samples from the Base value to their Model outputs? Each
path belongs to one Sample, and the most important Features form the vertical steps.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `explanation` | — | the SHAP explanation payload |
| `maxDisplay` | `15` | maximum number of Feature rows |
| `sampleIndices` | every Sample | zero-based Sample indices to draw |
| `groupByGenus` | `false` | use the Genus view instead of the Species view |
| `classIndex` | `1` | output to draw from a multi-output explanation |
| `width` | `720` | SVG width in pixels |
| `rowHeight` | `26` | pixels per Feature row |
| `colormap` | `"red_blue"` | `"red_blue"` or the neutral-midpoint `"red_white_blue"` |
| `tableView` | `"hidden"` | `"hidden"`, `"visible"`, or `"none"` |
| `labels` | SHAP wording | partial [`PlotLabels`](../README.md#wording) override |
| `onSampleClick` | — | called with the zero-based Sample index |

## Differences from SHAP

- `_decision.py` comments that it creates a symmetric axis around the Base value, but its limit
  branch does not always deliver one. Because the same limits clamp the colour scale, that can move
  the neutral colour away from the Base value. This chart always uses equal reach on both sides.
- The Genus view is available through `groupByGenus`; the Species view remains the default.
- `tableView` exposes each Sample's cumulative values in a real table for screen readers and text
  search. A matplotlib image produced by `_decision.py` cannot provide that access.
- `red_blue` remains the default used by `_decision.py`; `red_white_blue` offers a neutral midpoint
  for values around the Base value.

## Minimal usage

```tsx
import { Plots } from "shap-svg/react";

<Plots.decision explanation={explanation} sampleIndices={[0, 1, 2]} />;
```

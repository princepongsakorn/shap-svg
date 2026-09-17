# `Plots.embedding`

## What it answers

Which Samples received similar explanations? The default PCA positions Samples from their SHAP
value vectors, so nearby Samples reached their Model outputs for similar reasons.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `explanation` | — | the SHAP explanation payload |
| `colorBy` | `"sum"` | `"sum"`, `"none"`, or a Feature name or zero-based index |
| `coords` | — | one external `[x, y]` pair per Sample; when supplied, skips PCA |
| `groupByGenus` | `false` | use the Genus view instead of the Species view |
| `classIndex` | `1` | output to draw from a multi-output explanation |
| `width` | `620` | SVG width in pixels |
| `height` | `440` | SVG height in pixels |
| `colormap` | `"red_blue"` | `"red_blue"` or the neutral-midpoint `"red_white_blue"` |
| `tableView` | `"hidden"` | `"hidden"`, `"visible"`, or `"none"` |
| `labels` | SHAP wording | partial [`PlotLabels`](../README.md#wording) override |
| `onSampleClick` | — | called with the zero-based Sample index |

## Differences from SHAP

- `_embedding.py` calls `plt.axis("off")` after fitting its two-component PCA and discards the
  explained-variance ratios. This chart labels both axes with the percentage of SHAP variance each
  component explains. External `coords` retain axis labels but cannot report PCA variance.
- The Genus view is available through `groupByGenus`; the Species view remains the default.
- `tableView` keeps Sample coordinates and colours in a real table for screen readers and text
  search. A matplotlib image produced by `_embedding.py` cannot provide that access.
- `red_blue` remains the default used by `_embedding.py`; `red_white_blue` offers a neutral midpoint
  for values around zero.

## Minimal usage

```tsx
import { Plots } from "shap-svg/react";

<Plots.embedding explanation={explanation} />;
```

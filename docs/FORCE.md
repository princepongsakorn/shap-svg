# `Plots.force`

## What it answers

Which Features push one Sample's Model output above or below its Base value? Positive and negative
segments meet at the Model output in a compact, single-row explanation.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `explanation` | — | the SHAP explanation payload |
| `sampleIndex` | `0` | zero-based Sample index to explain |
| `maxDisplay` | `10` | Features shown; any beyond this become the Other features row |
| `faithfulOtherRow` | `false` | reproduce SHAP's boundary-row collapse when `true` |
| `groupByGenus` | `false` | use the Genus view instead of the Species view |
| `classIndex` | `1` | output to draw from a multi-output explanation |
| `width` | `720` | SVG width in pixels |
| `height` | `96` | SVG height in pixels |
| `tableView` | `"hidden"` | `"hidden"`, `"visible"`, or `"none"` |
| `labels` | SHAP wording | partial [`PlotLabels`](../README.md#wording) override |

## Differences from SHAP

- `_force_matplotlib.py` receives every Feature and suppresses labels below its contribution
  threshold, but it collapses nothing. At hundreds of Features those segments become too
  narrow for a browser chart, so `maxDisplay` gathers what it cannot show into an Other features row while
  preserving its summed SHAP value.
- The Genus view is available through `groupByGenus`; the Species view remains the default.
- `tableView` exposes every displayed segment in a real table for screen readers and text search. A
  matplotlib image produced by `_force_matplotlib.py` cannot provide that access.

## Minimal usage

```tsx
import { Plots } from "shap-svg/react";

<Plots.force explanation={explanation} sampleIndex={0} />;
```

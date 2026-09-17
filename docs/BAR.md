# `Plots.bar`

## What it answers

Which Features matter most across Samples? The bar length is mean absolute SHAP value. Optional
clustering keeps related Features adjacent and draws their hierarchy beside the bars.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `explanation` | — | the SHAP explanation payload |
| `maxDisplay` | `10` | Features shown; any beyond this become the Other features row |
| `faithfulOtherRow` | `false` | reproduce SHAP's boundary-row collapse when `true` |
| `groupByGenus` | `false` | use the Genus view instead of the Species view |
| `classIndex` | `1` | output to draw from a multi-output explanation |
| `width` | `720` | SVG width in pixels |
| `rowHeight` | `26` | pixels per Feature row |
| `labels` | SHAP wording | partial [`PlotLabels`](../README.md#wording) override |
| `clustering` | `false` | `"shap"`, `"data"`, a SciPy linkage matrix, or `false` |
| `clusteringCutoff` | `0.5` | distance at which the displayed tree is cut |
| `onFeatureClick` | — | called with the Feature index, or `null` for the Other features row |

## Differences from SHAP

- When a display cut would split a cluster, `_bar.py` calls `merge_nodes`, combines two Features,
  and labels the resulting row `A + B` when the name fits. This chart keeps taxa as separate rows and
  draws the cluster bracket beside them, so neither taxon loses its identity.
- `"data"` and `"shap"` compute clustering in the browser without a runtime dependency. A linkage
  matrix from Python is also accepted in the format returned by `hclust` in `utils/_clustering.py`.

## Minimal usage

```tsx
import { Plots } from "shap-svg/react";

<Plots.bar explanation={explanation} clustering="shap" />;
```

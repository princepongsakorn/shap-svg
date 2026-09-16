# Hover Tooltip and Scatter Axis Fix Report

## Status

Implemented the visual-testing fixes for `Plots.scatter`, `Plots.embedding`, and `Plots.decision`.

## Changes

- Replaced the scatter's ineffective per-hover SVG `<title>` with the same visible SVG tooltip pattern used by the beeswarm.
- Added visible tooltips to embedding points and decision paths.
- Used `placeTooltip` for all three charts, preserving its right-edge flip and chart-bound clamping.
- Resolved Sample names from `sampleLabels` with `sampleFallback` as the fallback.
- Added translated, formatted tooltip values for plotted Features, optional colour Features, SHAP values, embedding colour quantities, and decision Model outputs.
- Rendered `absent` for an undetected scatter Sample instead of numeric zero.
- Added scatter y ticks, tick marks, and the left and bottom spines while leaving the top and right spines hidden.
- Derived the scatter y domain from the complete plotted SHAP column, including both absent and detected Samples, and expanded it to enclosing nice ticks.
- Estimated the widest y tick label without DOM measurement and increased the left margin enough for both tick labels and the rotated title.
- Left the embedding without coordinate ticks or spines.

## Tests Added

- Tooltip line content for scatter, embedding, and decision.
- Scatter absent wording.
- Scatter y ticks enclosing SHAP values from both absent and detected Samples.
- Scatter left-margin capacity for the widest generated y tick.
- Scatter spine visibility.
- Distinct labels for sub-micro SHAP ticks and a centred scale for all-zero SHAP columns.
- Safe tooltip suppression when live props remove the currently hovered point.

## Verification

The final verification commands are:

```text
npm run typecheck
npm test
npm run build
```

`tests/ShapBar.test.ts` is checked by blob hash against `HEAD` and remains covered by the full test run.

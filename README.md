# shap-svg

Interactive SVG charts for [SHAP](https://github.com/shap/shap) explanations — **bar, beeswarm,
heatmap and waterfall** — drawn in the browser from SHAP values instead of shipped as rendered images.

```bash
npm install shap-svg
```

## Why this exists, and why the name

SHAP draws its plots with matplotlib, on the machine that computed the values. A web application
that wants to show them usually ends up rendering PNGs on the server and sending pictures to the
browser: every change of view is another round trip, and nothing in the picture can be hovered,
clicked or resized.

`shap-svg` takes the other route. The server sends the **SHAP values** — the same arrays a
`shap.Explanation` holds — and the charts are drawn as SVG on the client. Changing how many features
are shown, grouping them, sorting them or expanding a chart costs no request, because the numbers are
already there.

The name says exactly that: **SHAP** values in, **SVG** out. It is an independent project and is not
affiliated with the SHAP authors.

## What it draws

| Component | SHAP counterpart | Shows |
| --- | --- | --- |
| `ShapBar` | `shap.plots.bar` | mean(\|SHAP value\|) per feature across samples |
| `ShapBeeswarm` | `shap.plots.beeswarm` | one dot per sample per feature, coloured by feature value |
| `ShapHeatmap` | `shap.plots.heatmap` | samples × features coloured by SHAP value, with the f(x) line above |
| `ShapWaterfall` | `shap.plots.waterfall` | how one sample's prediction is built from E[f(X)] to f(x) |

Every chart is a pure component: all state that changes what is drawn arrives through props, so the
host application owns its own controls. The only internal state is hover highlighting.

## Usage

`shap-svg` draws SHAP values; it does not compute them. The values come from
[`shap`](https://github.com/shap/shap) in Python, travel through your server as JSON, and are handed to
a component in the browser:

```text
Python: shap computes the values  →  server returns them as JSON  →  browser fetches  →  <ShapWaterfall explanation={…} />
```

### 1. Compute SHAP values in Python and serialise them

```python
import numpy as np
import shap

explainer = shap.TreeExplainer(model)  # any shap explainer works


def to_payload(explanation: shap.Explanation, sample_ids=None) -> dict:
    """Serialise a shap.Explanation into the JSON shap-svg reads."""
    payload = {
        "contract_version": 1,
        "values": np.asarray(explanation.values, dtype=float).tolist(),
        "base_values": np.asarray(explanation.base_values, dtype=float).tolist(),
        "data": np.asarray(explanation.data, dtype=float).tolist(),
        "feature_names": [str(name) for name in explanation.feature_names],
    }
    if sample_ids is not None:
        payload["sample_ids"] = [str(sample_id) for sample_id in sample_ids]
    return payload
```

- **Pass the explanation as it comes.** A scikit-learn binary classifier gives `values` shaped
  `(samples, features, 2)` and `base_values` shaped `(samples, 2)`; `shap-svg` reads class 1 by default
  (`classIndex` on every component). There is no need to pick a class in Python.
- **Send only finite numbers.** Fill or drop missing feature values first. Flask's `jsonify` writes
  `NaN` unquoted, which is not valid JSON, and `parseExplanation` rejects it; serialising with
  `json.dumps(payload, allow_nan=False)` makes the mistake fail on the server instead.
- **`sample_ids` are optional** but give each Sample a stable key: the heatmap hands it back from
  `onSampleClick`. Add `sample_labels` for the names a person should read.

### 2. Return the payload from your server

```python
from flask import Flask, jsonify

app = Flask(__name__)


@app.post("/api/explain")
def explain():
    X = rows_to_explain()  # a pandas DataFrame, e.g. built from the request body
    explanation = explainer(X)
    return jsonify(to_payload(explanation, sample_ids=X.index))
```

Any framework works — the contract is only the JSON above. Serve it gzipped if you can: the payload is
mostly repeated digits and compresses well.

### 3. Fetch it in the browser and hand it to a component

```tsx
import { useEffect, useState } from "react";
import type { Explanation } from "shap-svg";
import { ShapBeeswarm, ShapWaterfall } from "shap-svg/react";

export function ExplanationView() {
  const [explanation, setExplanation] = useState<Explanation>();

  useEffect(() => {
    fetch("/api/explain", { method: "POST" })
      .then((response) => response.json())
      .then(setExplanation);
  }, []);

  if (!explanation) return <p>Loading…</p>;

  return (
    <>
      <ShapBeeswarm explanation={explanation} maxDisplay={15} groupByGenus rowSort="name" />
      <ShapWaterfall explanation={explanation} sampleIndex={0} decimals="percent" />
    </>
  );
}
```

From here every control — how many features, grouping, sorting, precision — is a prop. Changing one
redraws from the payload already in memory; nothing goes back to the server.

The framework-free core — parsing, ordering, collapsing, layout and colour — has no React import and
can drive any renderer:

```ts
import { parseExplanation, heatmapRows, heatmapLayout } from "shap-svg";

const rows = heatmapRows(parseExplanation(payload), 15, false);
const layout = heatmapLayout(rows, { width: 720, rowHeight: 26, marginLeft: 260, marginRight: 100, marginTop: 60 });
```

React (≥ 18) is an optional peer dependency, needed only for `shap-svg/react`.

## The explanation payload

Field names follow `shap.Explanation`, so a Python service can serialise one directly:

```jsonc
{
  "contract_version": 1,
  "values": [[0.012, -0.004]],          // n samples × p features (or n × p × classes)
  "base_values": [0.5238],              // per sample; a scalar is accepted and repeated
  "data": [[0.041, 0.0]],               // n × p feature values
  "feature_names": ["Bacteroides_dorei", "Parvimonas_micra"],
  "sample_ids": ["3f30aca9-…"],         // optional: stable keys for click-through
  "sample_labels": ["SAMD00114722"],    // optional: what a person reads; never used as a key
  "sample_label_column": "sample_id",   // optional: where the labels came from
  "model_name": "crc-rynazal-notebook"  // optional
}
```

`parseExplanation` validates shapes and rejects non-finite numbers before anything is drawn.

## Props

Shared by all four charts:

| Prop | Default | |
| --- | --- | --- |
| `explanation` | — | the payload above |
| `maxDisplay` | `10` | features shown before the rest collapse into one "other features" row |
| `faithfulOtherRow` | `false` | `true` reproduces SHAP's own behaviour, where the last displayed row absorbs the feature ranked `maxDisplay` |
| `groupByGenus` | `false` | sum `Genus_species` features into their genus first |
| `classIndex` | `1` | which output to draw for multi-output explanations |
| `width` | `720` | SVG width in pixels |
| `rowHeight` | per chart | pixels per feature row |
| `onFeatureClick` | — | called with the feature index, or `null` for the "other" row |

Per chart:

| Chart | Prop | Default | |
| --- | --- | --- | --- |
| `ShapBeeswarm`, `ShapHeatmap` | `rowSort` | `"importance"` | `"importance"`, `"name"` or `"featureValue"`; reorders the rows shown, never which rows are shown |
| `ShapBeeswarm` | `seed`, `dotRadius` | `0`, `3` | jitter is seeded, so a chart is identical on every render |
| `ShapHeatmap` | `onSampleClick` | — | called with the column's `sample_ids` entry |
| `ShapWaterfall` | `sampleIndex` | `0` | which sample to explain |
| `ShapWaterfall` | `decimals` | `2` | `2`, `3`, `4` or `"percent"`; display only |

## Faithful to SHAP where it matters

Ordering, the "other features" partition, colour maps, tick placement and the waterfall's geometry are
taken from SHAP 0.49.1's plotting code and tested against values captured by running SHAP itself:

- feature order and the collapsed row follow `shap.plots` exactly (with `faithfulOtherRow` for the
  byte-compatible variant);
- `red_blue` and `red_white_blue` are 256-entry tables captured from SHAP, not re-derived;
- axis ticks use matplotlib's `MaxNLocator` rule, and axis ranges its default margins;
- the waterfall draws SHAP's dashed connectors, its one-row base-value rule, and places value labels
  inside or outside each arrow by the same rule.

A few choices deliberately differ, each because SHAP's version does not read well in a browser:

- numbers use significant figures (or a chosen precision) rather than `%0.03f`, which prints most
  small SHAP values as `0`;
- species names are set in italics with underscores replaced by spaces;
- colour scales carry numeric ends rather than only "High" and "Low";
- the heatmap's f(x) line has a real axis;
- heatmap columns are ordered by each sample's total SHAP value rather than by hierarchical clustering;
- the beeswarm's jitter is seeded rather than random.

The golden fixtures under `tests/` and `fixtures/` were generated by
`tools/shap_fixtures/generate.py` in
[explainable-ai-microbiome-platform](https://github.com/princepongsakorn/explainable-ai-microbiome-platform),
where this package started.

## Related

- [mlflow-explainable](https://github.com/princepongsakorn/mlflow-explainable) logs a model and its
  SHAP explainer to MLflow as one artifact — the Python side that produces the values these charts draw.

## License

MIT

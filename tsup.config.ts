import { defineConfig } from "tsup";

/**
 * Two entry points, matching the two import paths: `shap-svg` is the
 * framework-free core, `shap-svg/react` the components. React stays external,
 * so the consumer's single copy is the one that renders.
 *
 * Both ESM and CommonJS are emitted. Hosts that do not compile node_modules —
 * Next.js 12, for one — need plain JavaScript here, not TypeScript.
 */
export default defineConfig({
  entry: { index: "index.ts", react: "react.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2019",
  external: ["react", "react/jsx-runtime", "react-dom"],
  tsconfig: "tsconfig.build.json",
});

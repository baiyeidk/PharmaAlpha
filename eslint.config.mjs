import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // ─── React 19 / Next 16 lint rule downgrades ────────────────
  // `react-hooks/set-state-in-effect` (added in eslint-plugin-react-hooks v6 /
  // React Compiler) flags any setState call reachable from a useEffect body.
  // Most of our `useEffect(() => { load() }, [])` patterns are legitimate
  // mount-time data loading; treating them as errors blocks CI without
  // surfacing a real bug. Downgrade to `warn` so the issues remain visible
  // for incremental cleanup but don't fail the pipeline.
  //
  // `react-hooks/immutability` over-reports legitimate `useCallback` / ref
  // recursion patterns (e.g. `requestAnimationFrame(draw)` inside the same
  // callback). Same reasoning: keep as `warn`.
  //
  // TODO: revisit each individual occurrence and either refactor or add
  //       targeted `// eslint-disable-next-line` comments, then re-promote
  //       to `error`.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;

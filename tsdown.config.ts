import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // Matches engines.node: Node >= 14 covers every feature the source uses
  // (ES2020 `??`/`matchAll`, `Intl.RelativeTimeFormat`, regex lookbehind).
  target: "node14",
  platform: "node",
});

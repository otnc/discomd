import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // Matches engines.node: Node >= 14 covers every feature the source uses
  // (ES2020 `??`/`matchAll`, `Intl.RelativeTimeFormat`, regex lookbehind).
  // tsup 6.x is the last line that runs on Node 14 (7+ requires Node 18).
  target: "node14",
  platform: "node",
});

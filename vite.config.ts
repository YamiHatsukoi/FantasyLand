import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the build works under https://<user>.github.io/<repo>/
  base: "./",
  build: { target: "es2020", chunkSizeWarningLimit: 1500 },
  // some tests generate all 100 floors or play whole arena matches: CI runners are slower
  test: { testTimeout: 60_000 },
});

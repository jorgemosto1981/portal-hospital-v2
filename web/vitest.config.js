import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@portalV2": path.join(repoRoot, "src"),
    },
  },
});

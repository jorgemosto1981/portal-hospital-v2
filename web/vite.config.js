import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /** Variables `VITE_V2_*` en la raíz del repo (p. ej. `.env.v2.local`). */
  envDir: repoRoot,
  resolve: {
    alias: {
      "@portalV2": path.join(repoRoot, "src"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});

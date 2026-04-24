import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/**
 * Vite solo carga por defecto `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`.
 * El repo usa `.env.v2.local` en la raíz — lo parseamos e inyectamos en `import.meta.env`.
 */
function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function buildViteEnvDefine(mode) {
  const v2Path = path.join(repoRoot, ".env.v2.local");
  const fromV2File = parseEnvFile(v2Path);
  const fromVite = loadEnv(mode, repoRoot, "VITE_");
  const merged = { ...fromVite, ...fromV2File };
  /** @type {Record<string, string>} */
  const define = {};
  for (const [key, val] of Object.entries(merged)) {
    if (!key.startsWith("VITE_")) continue;
    define[`import.meta.env.${key}`] = JSON.stringify(val ?? "");
  }
  return define;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: buildViteEnvDefine(mode),
  /** También sirve para otros `.env*` estándar en la raíz. */
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
}));

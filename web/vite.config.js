import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
/** Una sola copia del SDK (evita "Service firestore is not available" si `src/` resolviera `firebase` desde la raíz del repo). */
const firebaseRoot = path.resolve(__dirname, "node_modules", "firebase");

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
  plugins: [react(), tailwindcss()],
  define: buildViteEnvDefine(mode),
  /** También sirve para otros `.env*` estándar en la raíz. */
  envDir: repoRoot,
  resolve: {
    dedupe: ["firebase"],
    alias: {
      "@portalV2": path.join(repoRoot, "src"),
      "firebase/app": path.join(firebaseRoot, "app"),
      "firebase/auth": path.join(firebaseRoot, "auth"),
      "firebase/firestore": path.join(firebaseRoot, "firestore"),
      "firebase/storage": path.join(firebaseRoot, "storage"),
      "firebase/analytics": path.join(firebaseRoot, "analytics"),
      "firebase/functions": path.join(firebaseRoot, "functions"),
    },
  },
  optimizeDeps: {
    include: [
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
      "firebase/analytics",
      "firebase/functions",
    ],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.js"],
  },
}));

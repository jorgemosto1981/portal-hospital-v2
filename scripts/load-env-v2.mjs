/**
 * Carga variables desde `.env.v2.local` en la raíz del repo (p. ej. GOOGLE_APPLICATION_CREDENTIALS).
 * Importar como **primera** línea de cualquier script ESM de Admin/Node:
 *   import "./load-env-v2.mjs";   (desde `scripts/…`)
 *   import "../../scripts/load-env-v2.mjs";  (desde `src/scripts/…`)
 */
import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
dotenv.config({ path: join(repoRoot, ".env.v2.local") });

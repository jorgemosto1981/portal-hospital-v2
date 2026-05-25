/**
 * CI R5 — Auditoría semántica: campos de cfgArticuloVersionSchema vs Mapa RFC §4.
 *
 * Falla (exit 1) si hay hojas en Zod sin fila en el mapa (semántica muerta).
 * Advierte si hay entradas del mapa que ya no existen en el schema.
 *
 * Uso: npm run audit:lao-campos-version
 * Ref: docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §12
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cfgArticuloVersionSchema } from "../web/src/schemas/articulo.schema.js";
import {
  CAMPOS_CONSUMIDOS_LAO,
  CAMPOS_FUERA_MOTOR,
  CAMPOS_NA_LAO,
  CAMPOS_PERMITIDOS_VERSION_LAO,
  pathPermitidoEnMapa,
} from "./lib/laoCamposVersionMapaRfc.mjs";
import { collectZodLeafPaths } from "./lib/zodVersionLeafPaths.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const schemaPaths = [...new Set(collectZodLeafPaths(cfgArticuloVersionSchema))].sort();

const huerfanos = schemaPaths.filter((p) => !pathPermitidoEnMapa(p));
const mapaSinSchema = [...CAMPOS_PERMITIDOS_VERSION_LAO]
  .filter((entry) => !entry.endsWith(".*"))
  .filter((entry) => !schemaPaths.includes(entry))
  .sort();

console.log("=== Auditoría campos versión LAO (RFC §12 / R5) ===");
console.log(`Repo: ${repoRoot}`);
console.log(`Hojas en cfgArticuloVersionSchema: ${schemaPaths.length}`);
console.log(
  `Mapa permitido: ${CAMPOS_PERMITIDOS_VERSION_LAO.length} ` +
    `(consumido ${CAMPOS_CONSUMIDOS_LAO.length}, N/A ${CAMPOS_NA_LAO.length}, FM ${CAMPOS_FUERA_MOTOR.length})`,
);
console.log("");

if (huerfanos.length > 0) {
  console.log(`[FAIL] ${huerfanos.length} campo(s) en schema sin fila en Mapa §4:`);
  for (const p of huerfanos) console.log(`  - ${p}`);
  console.log("");
  console.log("Acción RRHH/desarrollo: añadir fila en RFC §4 + scripts/lib/laoCamposVersionMapaRfc.mjs");
  console.log("  o eliminar del schema si no aplica al motor LAO.");
} else {
  console.log("[OK]   Todos los campos del schema están mapeados (consumido | N/A LAO | fuera motor).");
}

if (mapaSinSchema.length > 0) {
  console.log("");
  console.log(`[WARN] ${mapaSinSchema.length} entrada(s) del mapa no aparecen como hoja en Zod:`);
  for (const p of mapaSinSchema) console.log(`  - ${p}`);
  console.log("  (Renombrar mapa o ampliar schema; wildcards .* no se listan aquí.)");
}

console.log("");
if (huerfanos.length > 0) {
  process.exit(1);
}
process.exit(0);

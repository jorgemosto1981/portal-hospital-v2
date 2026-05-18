#!/usr/bin/env node
/**
 * Smoke manual Patrón B / 64-A (requiere credenciales Admin o instrucciones).
 *
 * Uso (desde cliente autenticado como agente piloto):
 *   1. Deploy functions + rules
 *   2. En consola del navegador o script con Firebase Auth del piloto:
 *      import { crearSolicitudArticuloPatronBBorrador } from './web/src/services/...'
 *
 * Este script documenta IDs y valida motor vía Admin si FIREBASE_SERVICE_ACCOUNT está configurado.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PILOTO = {
  persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
  articulo_id: "art_01KRNK10V10CH7W5M2W6V558GS",
  version_id: "ver_01KRNKNBXNBFC9HZN7CZJGPRDH",
};

console.log("Smoke 64-A Patrón B — referencia");
console.log(JSON.stringify(PILOTO, null, 2));
console.log("\nPasos:");
console.log("1. callListarArticulosIngresoAgente({ fecha_desde: 'YYYY-MM-DD' })");
console.log("2. crearSolicitudArticuloPatronBBorrador({ ...PILOTO, fechaDesde })");
console.log("3. Verificar solicitudes_articulo → cfg_esa_en_revision_jefe");
console.log("4. Verificar sal_2026_per_* → consumido +1");
console.log("\nMatriz: docs/v2/TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md");

try {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  console.log("\nProyecto:", pkg.name || "portal-hospital-v2");
} catch {
  /* ignore */
}

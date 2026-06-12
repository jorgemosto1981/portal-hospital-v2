/**
 * Sincroniza los módulos compartidos de shared/utils/ (ESM, fuente de verdad)
 * a functions/modules/shared/ (CJS, requerido por Cloud Functions deploy).
 *
 * Ejecutar: node scripts/sync-shared-to-functions.mjs
 * También se ejecuta automáticamente como predeploy hook de Firebase.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharedDir = join(repoRoot, "shared", "utils");
const functionsDir = join(repoRoot, "functions", "modules", "shared");

const HEADER = `"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.
`;

const FILES_TO_SYNC = [
  "fechaInstitucionalBa.js",
  "fechaLaboralYmd.js",
  "antiguedadCalculator.js",
  "laoVersionResolver.js",
  "laoSaldosBolsa.js",
  "hlcOperativo.js",
  "hlcVigenciaFecha.js",
  "resolvePatronSaldo.js",
  "solicitudElegibilidadLaboral.js",
  "calendarInstitucionalCore.js",
  "validarFechasArticulo.js",
  "modoComputoCalendario.js",
  "horarioInstitucionalDisplay.js",
  "grillaTeoriaDesalineacion.js",
  "grillaFichadaPresencia.js",
  "fichadasDeltaCeldaDia.js",
  "fichadasValidacionMarcas.js",
  "fichadasAlineacionTeoria.js",
];

function esmToCjs(source, filename) {
  let code = source;

  // Quitar imports ESM y recolectar los bindings
  const imports = [];
  code = code.replace(
    /^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];\s*$/gm,
    (_match, bindings, specifier) => {
      const cleanSpec = specifier.replace(/\.js$/, "");
      imports.push(`const {${bindings}} = require("${cleanSpec}");`);
      return "";
    },
  );

  // Quitar re-exports: export { FOO } from "..."; y export { FOO };
  const reExports = [];
  code = code.replace(
    /^export\s*\{([^}]+)\}\s*from\s*["'][^"']+["'];\s*$/gm,
    (_match, bindings) => {
      reExports.push(...bindings.split(",").map((b) => b.trim()));
      return "";
    },
  );
  code = code.replace(
    /^export\s*\{([^}]+)\};\s*$/gm,
    (_match, bindings) => {
      reExports.push(...bindings.split(",").map((b) => b.trim()));
      return "";
    },
  );

  // Convertir export function / export const
  const namedExports = [];
  code = code.replace(/^export (function|const)\s+(\w+)/gm, (_match, kw, name) => {
    namedExports.push(name);
    return `${kw} ${name}`;
  });

  // Convertir export default (si existe)
  code = code.replace(/^export default /gm, "const _default = ");

  // Construir module.exports
  const allExports = [...new Set([...reExports, ...namedExports])];
  const exportsBlock = allExports.length
    ? `\nmodule.exports = { ${allExports.join(", ")} };\n`
    : "";

  return `${HEADER}\n${imports.join("\n")}${imports.length ? "\n" : ""}\n${code.trim()}\n${exportsBlock}`;
}

let synced = 0;
for (const file of FILES_TO_SYNC) {
  const srcPath = join(sharedDir, file);
  const destPath = join(functionsDir, file);
  const source = readFileSync(srcPath, "utf-8");
  const cjs = esmToCjs(source, file);
  writeFileSync(destPath, cjs, "utf-8");
  synced++;
  console.log(`  ✓ ${file} → functions/modules/shared/${file}`);
}

console.log(`\nSincronizados ${synced} archivo(s) shared → functions (ESM → CJS).`);

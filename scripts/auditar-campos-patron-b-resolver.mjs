/**
 * CI Audit — verifica que todos los campos del schema Zod de articulo.schema.js
 * tengan consumidor en patronBMotorConfigResolver.js.
 *
 * Salida: 0 si 0 huerfanos, 1 si hay campos sin consumidor.
 *
 * Uso:
 *   node scripts/auditar-campos-patron-b-resolver.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA_PATH = join(repoRoot, "web/src/schemas/articulo.schema.js");
const RESOLVER_PATH = join(repoRoot, "functions/modules/shared/patronBMotorConfigResolver.js");

const LAO_ONLY_FIELDS = new Set([
  "correspondencia_anio",
  "fecha_corte_antiguedad",
  "matriz_antiguedad_reglas",
  "mes_dia_apertura_solicitudes",
  "tse_minimo_dias_base",
  "permite_calculo_proporcional_tse",
]);

const BLOQUE_NAMES = [
  { schema: "bloqueIdentidadNaturalezaSchema", label: "bloque_identidad_naturaleza" },
  { schema: "bloqueImpactoEconomicoSchema", label: "bloque_impacto_economico" },
  { schema: "bloqueElegibilidadFiltrosSchema", label: "bloque_elegibilidad_filtros" },
  { schema: "bloqueTopesPlazosComputoSchema", label: "bloque_topes_plazos_computo" },
  { schema: "bloqueAcumulacionSucesionSchema", label: "bloque_acumulacion_sucesion" },
  { schema: "bloqueWorkflowSlaCoberturaSchema", label: "bloque_workflow_sla_cobertura" },
  { schema: "bloqueDocumentacionConvivenciaSchema", label: "bloque_documentacion_convivencia" },
];

const NESTED_OBJECT_SCHEMAS = new Set([
  "normativaHabilitanteSchema",
  "visualizacionSchema",
]);

function extractZodObjectFields(schemaText, schemaName) {
  const marker = `${schemaName} = z`;
  const startIdx = schemaText.indexOf(marker);
  if (startIdx === -1) return [];

  const objectStart = schemaText.indexOf(".object(", startIdx);
  if (objectStart === -1 || objectStart - startIdx > 100) return [];

  const braceStart = schemaText.indexOf("{", objectStart);
  if (braceStart === -1) return [];

  let depth = 1;
  let braceEnd = -1;
  for (let i = braceStart + 1; i < schemaText.length; i++) {
    if (schemaText[i] === "{") depth++;
    if (schemaText[i] === "}") {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  if (braceEnd === -1) return [];

  const block = schemaText.slice(braceStart + 1, braceEnd);
  const strictIdx = block.indexOf(".strict()");
  const effectiveBlock = strictIdx >= 0 ? block.slice(0, strictIdx) : block;

  const fields = [];
  const rx = /^\s{2,4}(\w+)\s*:/gm;
  let m;
  while ((m = rx.exec(effectiveBlock)) !== null) {
    if (m[1] !== "code" && m[1] !== "message" && m[1] !== "path") {
      fields.push(m[1]);
    }
  }
  return [...new Set(fields)];
}

function extractSchemaFields(schemaText, parentSchemaName) {
  const fields = extractZodObjectFields(schemaText, parentSchemaName);
  const expanded = [];

  for (const f of fields) {
    const startIdx = schemaText.indexOf(`${parentSchemaName} = z`);
    const block = schemaText.slice(startIdx, startIdx + 5000);
    const nestedRx = new RegExp(`${f}\\s*:\\s*(\\w+Schema)`);
    const m = nestedRx.exec(block);

    if (m && NESTED_OBJECT_SCHEMAS.has(m[1])) {
      const nestedFields = extractZodObjectFields(schemaText, m[1]);
      if (nestedFields.length > 0) {
        for (const nf of nestedFields) {
          expanded.push({ field: `${f}.${nf}`, parent: f, nested: nf });
        }
        continue;
      }
    }
    expanded.push({ field: f, parent: null, nested: null });
  }
  return expanded;
}

const schemaText = readFileSync(SCHEMA_PATH, "utf8");
const resolverText = readFileSync(RESOLVER_PATH, "utf8");

console.log("=".repeat(60));
console.log("CI AUDIT — Campos Schema vs Patron B Config Resolver");
console.log("=".repeat(60));

let totalCampos = 0;
let totalConsumed = 0;
let totalLaoOnly = 0;
let totalOrphan = 0;
const orphans = [];

for (const bloque of BLOQUE_NAMES) {
  const fields = extractSchemaFields(schemaText, bloque.schema);
  console.log(`\n[${bloque.label}] (${fields.length} campos)`);

  for (const { field, parent, nested } of fields) {
    totalCampos++;
    const baseField = nested || field;

    if (LAO_ONLY_FIELDS.has(baseField)) {
      console.log(`  SKIP  ${field} (LAO-only)`);
      totalLaoOnly++;
      continue;
    }

    const consumed = resolverText.includes(baseField);
    if (consumed) {
      console.log(`  OK    ${field}`);
      totalConsumed++;
    } else {
      console.log(`  MISS  ${field}`);
      totalOrphan++;
      orphans.push({ bloque: bloque.label, field });
    }
  }
}

console.log("\n" + "=".repeat(60));
console.log("RESUMEN:");
console.log(`  Total campos schema: ${totalCampos}`);
console.log(`  Consumidos:          ${totalConsumed}`);
console.log(`  LAO-only (skip):     ${totalLaoOnly}`);
console.log(`  Huerfanos:           ${totalOrphan}`);
console.log("=".repeat(60));

if (orphans.length > 0) {
  console.error("\nCAMPOS HUERFANOS (sin consumidor en resolver):");
  for (const o of orphans) {
    console.error(`  - ${o.bloque} -> ${o.field}`);
  }
  console.error(`\nAUDIT FALLIDO: ${orphans.length} campo(s) sin consumidor.`);
  process.exit(1);
}

console.log("\nAUDIT OK: 0 huerfanos — todos los campos tienen consumidor.");
process.exit(0);

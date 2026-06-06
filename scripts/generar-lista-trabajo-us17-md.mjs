/**
 * Genera Markdown RRHH desde JSON de audit US-17.
 * Uso: node scripts/generar-lista-trabajo-us17-md.mjs [ruta-json] [ruta-md-out]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = process.argv[2] || join(repoRoot, "reports/us17-2026-06-05.json");
const outPath =
  process.argv[3] || join(repoRoot, "reports/US17_LISTA_TRABAJO_RRHH_2026-06-05.md");

const GDT_LABEL = {
  gdt_01KQA6QCA8TDQK9YBTHKYA4R2V: "Sala Internación 1",
  gdt_01KR3H81ENQK84ZK21EQWEQQXG: "Oficina PERSONAL",
};

const data = JSON.parse(readFileSync(jsonPath, "utf8"));

function accionAlta() {
  return "Asignar turno o franco explícito (celda vacía en plan y en grilla)";
}

function accionMedia() {
  return "Abrir editor y **confirmar/persistir** el turno que ya se ve en grilla";
}

const lines = [];
lines.push("# US-17 — Lista de trabajo RRHH (remediación planes)");
lines.push("");
lines.push(
  `> Generado: ${data.generado_en} · BD: **portal-hospital-v2** (solo lectura) · Criterio: US-9`,
);
lines.push(`> JSON fuente: \`reports/us17-2026-06-05.json\``);
lines.push("");
lines.push("## Resumen");
lines.push("");
lines.push("| Métrica | Valor |");
lines.push("|---------|------:|");
lines.push(`| Planes HABILITADO analizados | ${data.planes_escaneados_us17} |`);
lines.push(`| Planes con huecos | ${data.planes_con_huecos_o_sin_agentes} |`);
lines.push(`| **Total celdas US-9** | **${data.total_huecos_celdas}** |`);
lines.push(
  `| Prioridad **ALTA** (sin jornada en grilla) | **${data.total_huecos_severidad_alta}** |`,
);
lines.push(
  `| Prioridad **MEDIA** (grilla OK, plan sin persistir) | **${data.total_huecos_severidad_media}** |`,
);
lines.push("");
lines.push("**Meta de cierre:** re-ejecutar audit hasta `total_huecos_celdas = 0`.");
lines.push("");
lines.push("## Instrucciones generales");
lines.push("");
lines.push("1. RRHH pone el plan en **EN_REVISION** (Explorador de turnos) si está HABILITADO.");
lines.push("2. Jefe/evaluador abre el **editor mensual** del plan indicado.");
lines.push(`3. Por cada celda: ${accionAlta()} (ALTA) o confirmar turno visible (MEDIA).`);
lines.push("4. **Guardar** plan → RRHH **habilita** de nuevo (US-9 debe aprobar).");
lines.push("5. **Orden sugerido:** remediar todas las **ALTA** antes de las **MEDIA**.");
lines.push("");
lines.push("## Tabla por plan");
lines.push("");
lines.push("| Prioridad | Plan ID | Grupo | Período | Huecos | ALTA | MEDIA |");
lines.push("|-----------|---------|-------|---------|-------:|-----:|------:|");

const planesOrden = [...data.planes].sort((a, b) => {
  if (b.huecos_severidad_alta !== a.huecos_severidad_alta) {
    return b.huecos_severidad_alta - a.huecos_severidad_alta;
  }
  return b.huecos_count - a.huecos_count;
});

for (const p of planesOrden) {
  const prio = p.huecos_severidad_alta > 0 ? "**P0**" : "P1";
  const g = GDT_LABEL[p.grupo_id] || p.grupo_id;
  lines.push(
    `| ${prio} | \`${p.plan_id}\` | ${g} | ${p.periodo} | ${p.huecos_count} | ${p.huecos_severidad_alta} | ${p.huecos_severidad_media} |`,
  );
}

lines.push("");
lines.push("## Detalle P0 — celdas ALTA (atender primero)");
lines.push("");
lines.push("| Plan | Grupo | Período | Persona | Fecha | Tipo | Acción |");
lines.push("|------|-------|---------|---------|-------|------|--------|");

const altas = [];
for (const p of data.planes) {
  for (const h of p.huecos.filter((x) => x.severidad === "ALTA")) {
    altas.push({ ...h, plan_id: p.plan_id, grupo_id: p.grupo_id, periodo: p.periodo });
  }
}
altas.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.ymd.localeCompare(b.ymd));

for (const h of altas) {
  const g = GDT_LABEL[h.grupo_id] || h.grupo_id;
  lines.push(
    `| \`${h.plan_id}\` | ${g} | ${h.periodo} | \`${h.persona_id}\` | **${h.ymd}** | ${h.tipo_dia} | ${accionAlta()} |`,
  );
}

lines.push("");
lines.push("## Detalle P1 — celdas MEDIA (por plan y persona)");
lines.push("");
lines.push(
  "En estas filas la grilla **ya muestra** jornada; falta **guardar** el `turno_id` en el plan.",
);
lines.push("");

for (const p of planesOrden) {
  if (p.huecos_severidad_media === 0) continue;
  const g = GDT_LABEL[p.grupo_id] || p.grupo_id;
  lines.push(
    `### \`${p.plan_id}\` · ${g} · ${p.periodo} (${p.huecos_severidad_media} MEDIA)`,
  );
  lines.push("");
  const byPerson = new Map();
  for (const h of p.huecos.filter((x) => x.severidad === "MEDIA")) {
    const pid = h.persona_id;
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid).push(h.ymd);
  }
  for (const [pid, fechas] of [...byPerson.entries()].sort()) {
    fechas.sort();
    lines.push(`- \`${pid}\`: ${fechas.join(", ")}`);
  }
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push(
  "Referencia: [`docs/v2/PLAN_VUELO_US17_INVENTARIO_PLANES.md`](../docs/v2/PLAN_VUELO_US17_INVENTARIO_PLANES.md)",
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("Escrito:", outPath);

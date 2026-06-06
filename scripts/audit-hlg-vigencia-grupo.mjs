/**
 * Auditoría HLg vigentes: solape persona+grupo, continuidad, tramos en mes, cruce vis_*.
 * Solo lectura. Requiere GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local).
 *
 * Uso:
 *   node scripts/audit-hlg-vigencia-grupo.mjs
 *   node scripts/audit-hlg-vigencia-grupo.mjs --persona=per_xxx --grupo=gdt_xxx --periodo=2026-06
 *   node scripts/audit-hlg-vigencia-grupo.mjs --json --out=reports/audit-hlg.json
 *   node scripts/audit-hlg-vigencia-grupo.mjs --out=reports/audit_mosto_jun26.md ...
 */
import "./load-env-v2.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { hasRangoSolapado, hlgCuentaParaSolapeOperativo } = require(
  join(repoRoot, "functions/modules/laboral/hlgValidacionesCore.js"),
);
const { buildVisDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_PLANES = "planes_turno_servicio";

function parseArgs(argv) {
  const opts = { json: false, out: "", dni: "", persona: "", grupo: "", periodo: "" };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--out=")) opts.out = arg.slice(6).trim();
    else if (arg.startsWith("--dni=")) opts.dni = arg.slice(6).trim();
    else if (arg.startsWith("--persona=")) opts.persona = arg.slice(10).trim();
    else if (arg.startsWith("--grupo=")) opts.grupo = arg.slice(8).trim();
    else if (arg.startsWith("--periodo=")) opts.periodo = arg.slice(10).trim();
  }
  return opts;
}

function loadServiceAccount() {
  const envFile = join(repoRoot, ".env.v2.local");
  let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!gac) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        gac = t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
  if (!gac) {
    console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
    process.exit(1);
  }
  return JSON.parse(readFileSync(gac, "utf8"));
}

function rangoPeriodo(periodo) {
  const p = String(periodo || "").trim();
  if (!/^\d{4}-\d{2}$/.test(p)) return null;
  const [anio, mes] = p.split("-").map(Number);
  const ultimo = new Date(anio, mes, 0).getDate();
  return {
    periodo: p,
    primerDia: `${p}-01`,
    ultimoDia: `${p}-${String(ultimo).padStart(2, "0")}`,
    anio,
    mes,
    diasMes: ultimo,
  };
}

function hlgSolapaPeriodo(hlg, primerDia, ultimoDia) {
  if (!hlg || hlg.activo === false) return false;
  if (!hlgCuentaParaSolapeOperativo(hlg)) return false;
  const fi = String(hlg.fecha_inicio || "").slice(0, 10);
  const ff = hlg.fecha_fin ? String(hlg.fecha_fin).slice(0, 10) : null;
  if (fi && fi > ultimoDia) return false;
  if (ff && ff < primerDia) return false;
  return true;
}

function vigenteHlgEnCorte(fechaInicio, fechaFin, corteYmd) {
  const c = String(corteYmd || "").slice(0, 10);
  const i = String(fechaInicio || "").slice(0, 10);
  const f = fechaFin ? String(fechaFin).slice(0, 10) : "9999-12-31";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c) || !/^\d{4}-\d{2}-\d{2}$/.test(i)) return false;
  return i <= c && c <= f;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function diasEntreExclusive(finA, iniB) {
  const out = [];
  let cur = addDaysYmd(finA, 1);
  const end = addDaysYmd(iniB, -1);
  while (cur <= end) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

function celdaResumen(c) {
  if (!c || typeof c !== "object") return { tipo: "vacío", horario: "", turno_id: null };
  const ing = String(c.rda_ingreso || "").trim();
  const egr = String(c.rda_egreso || "").trim();
  const horario = ing || egr ? `${ing || "?"}–${egr || "?"}` : "";
  return { tipo: String(c.tipo_dia || c.rda_tipo_dia || "—"), horario, turno_id: c.rda_turno_id || c.turno_id || null };
}

async function resolvePersonaId(db, opts) {
  if (opts.persona) return opts.persona;
  if (!opts.dni) return null;
  const snap = await db.collection("personas").where("dni", "==", opts.dni).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function loadHlgs(db, opts) {
  let snap;
  if (opts.grupo) {
    snap = await db.collection(COL_HLG).where("grupo_de_trabajo_id", "==", opts.grupo).get();
  } else {
    snap = await db.collection(COL_HLG).get();
  }
  const rows = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (opts.persona && String(d.persona_id || "") !== opts.persona) continue;
    rows.push({
      id: doc.id,
      persona_id: String(d.persona_id || ""),
      grupo_de_trabajo_id: String(d.grupo_de_trabajo_id || ""),
      activo: d.activo,
      eliminado: d.eliminado,
      estado: d.estado,
      fecha_inicio: d.fecha_inicio || null,
      fecha_fin: d.fecha_fin || null,
      regimen_horario_id: d.regimen_horario_id || null,
      carga_horaria_semanal: d.carga_horaria_semanal ?? null,
      raw: d,
    });
  }
  return rows;
}

function detectarSolapes(hlgs) {
  const operativas = hlgs.filter((h) => hlgCuentaParaSolapeOperativo(h.raw || h));
  const pares = [];
  for (let i = 0; i < operativas.length; i += 1) {
    for (let j = i + 1; j < operativas.length; j += 1) {
      const a = operativas[i];
      const b = operativas[j];
      if (a.persona_id !== b.persona_id || a.grupo_de_trabajo_id !== b.grupo_de_trabajo_id) continue;
      if (
        hasRangoSolapado({
          desdeA: a.fecha_inicio,
          hastaA: a.fecha_fin,
          desdeB: b.fecha_inicio,
          hastaB: b.fecha_fin,
        })
      ) {
        pares.push({
          severidad: "CRITICO",
          persona_id: a.persona_id,
          grupo_de_trabajo_id: a.grupo_de_trabajo_id,
          hlg_a: a.id,
          hlg_b: b.id,
          fechas_a: [a.fecha_inicio, a.fecha_fin],
          fechas_b: [b.fecha_inicio, b.fecha_fin],
        });
      }
    }
  }
  return pares;
}

function detectarContinuidad(hlgs) {
  const byKey = new Map();
  for (const h of hlgs.filter((x) => hlgCuentaParaSolapeOperativo(x.raw || x))) {
    const k = `${h.persona_id}::${h.grupo_de_trabajo_id}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(h);
  }
  const eventos = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => String(a.fecha_inicio || "").localeCompare(String(b.fecha_inicio || "")));
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const finA = a.fecha_fin ? String(a.fecha_fin).slice(0, 10) : null;
      const iniB = String(b.fecha_inicio || "").slice(0, 10);
      if (!finA || !iniB) continue;
      const esperado = addDaysYmd(finA, 1);
      if (iniB === esperado) {
        eventos.push({ tipo: "CONTIGUOUS", key, hlg_a: a.id, hlg_b: b.id, corte: `${finA} → ${iniB}`, dias_huerfanos: [] });
      } else if (iniB <= finA) {
        eventos.push({ tipo: "OVERLAP", severidad: "CRITICO", key, hlg_a: a.id, hlg_b: b.id, corte: `${finA} / ${iniB}`, dias_huerfanos: [] });
      } else if (iniB > esperado) {
        const dias_huerfanos = diasEntreExclusive(finA, iniB);
        eventos.push({ tipo: "GAP", key, hlg_a: a.id, hlg_b: b.id, corte: `${finA} … ${iniB}`, dias_huerfanos });
      }
    }
  }
  return eventos;
}

function tramosEnMes(hlgs, rango) {
  const out = [];
  for (const h of hlgs) {
    if (!hlgSolapaPeriodo(h.raw || h, rango.primerDia, rango.ultimoDia)) continue;
    const fi = String(h.fecha_inicio || "").slice(0, 10);
    const ff = h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : rango.ultimoDia;
    out.push({
      hlg_id: h.id,
      persona_id: h.persona_id,
      grupo_de_trabajo_id: h.grupo_de_trabajo_id,
      regimen_horario_id: h.regimen_horario_id,
      carga_horaria_semanal: h.carga_horaria_semanal,
      vigente_desde: fi > rango.primerDia ? fi : rango.primerDia,
      vigente_hasta: ff < rango.ultimoDia ? ff : rango.ultimoDia,
      fecha_inicio: h.fecha_inicio,
      fecha_fin: h.fecha_fin,
    });
  }
  out.sort((a, b) => `${a.persona_id}${a.vigente_desde}`.localeCompare(`${b.persona_id}${b.vigente_desde}`));
  return out;
}

async function cruceVisTramos(db, tramos, rango, diasHuerfanosGlobal) {
  const huerfanosSet = new Set(diasHuerfanosGlobal || []);
  const resultados = [];
  for (const t of tramos) {
    const visId = buildVisDocumentId(t.persona_id, rango.primerDia, t.grupo_de_trabajo_id);
    const snap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
    const dias = snap.exists && snap.data()?.dias ? snap.data().dias : {};
    const desde = Number(t.vigente_desde.slice(8, 10));
    const hasta = Number(t.vigente_hasta.slice(8, 10));
    const muestras = [];
    for (const dia of [desde, Math.floor((desde + hasta) / 2), hasta].filter((d, i, arr) => arr.indexOf(d) === i)) {
      const ymd = `${rango.periodo}-${String(dia).padStart(2, "0")}`;
      const key = diaMesKeyDesdeYmd(ymd) || String(dia).padStart(2, "0");
      muestras.push({ ymd, ...celdaResumen(dias[key] || dias[String(dia)]) });
    }
    let regimenTipo = null;
    if (t.regimen_horario_id) {
      const rs = await db.collection(COL_REGIMEN).doc(t.regimen_horario_id).get();
      regimenTipo = rs.exists ? rs.data()?.tipo_patron || null : null;
    }
    const vis_en_gap = [];
    for (const ymd of huerfanosSet) {
      if (!ymd.startsWith(rango.periodo)) continue;
      const key = diaMesKeyDesdeYmd(ymd) || ymd.slice(8, 10);
      const c = dias[key] || dias[ymd.slice(8, 10)];
      const s = celdaResumen(c);
      if (s.tipo !== "vacío" && (s.horario || s.turno_id)) vis_en_gap.push({ ymd, ...s });
    }
    resultados.push({
      ...t,
      vis_id: visId,
      vis_existe: snap.exists,
      regimen_tipo_patron: regimenTipo,
      muestras_celdas: muestras,
      flags: vis_en_gap.length ? [{ code: "VIS_EN_GAP", detalle: vis_en_gap }] : [],
    });
  }
  return resultados;
}

async function inconsistenciaListadoMes(db, hlgs, rango, grupoFilter) {
  const gdt = grupoFilter || null;
  const grupos = gdt ? [gdt] : [...new Set(hlgs.map((h) => h.grupo_de_trabajo_id).filter(Boolean))];
  const rows = [];
  const fechaCorte = rango.ultimoDia;

  for (const gid of grupos) {
    const delGrupo = hlgs.filter((h) => h.grupo_de_trabajo_id === gid && hlgCuentaParaSolapeOperativo(h.raw || h));
    const solapanMes = delGrupo.filter((h) => hlgSolapaPeriodo(h.raw || h, rango.primerDia, rango.ultimoDia));
    const vigentesCierre = solapanMes.filter((h) => vigenteHlgEnCorte(h.fecha_inicio, h.fecha_fin, fechaCorte));
    const personasSolapan = new Set(solapanMes.map((h) => h.persona_id));
    const personasCierre = new Set(vigentesCierre.map((h) => h.persona_id));
    for (const pid of personasSolapan) {
      if (!personasCierre.has(pid)) {
        rows.push({
          persona_id: pid,
          grupo_de_trabajo_id: gid,
          motivo: "solapa_mes_pero_no_vigente_al_cierre",
          fecha_corte: fechaCorte,
        });
      }
    }
    for (const pid of personasSolapan) {
      const tramos = solapanMes.filter((h) => h.persona_id === pid);
      if (tramos.length >= 2) {
        rows.push({
          persona_id: pid,
          grupo_de_trabajo_id: gid,
          motivo: "multiples_tramos_mes",
          tramos: tramos.map((t) => ({
            hlg_id: t.id,
            fecha_inicio: t.fecha_inicio,
            fecha_fin: t.fecha_fin,
            carga_horaria_semanal: t.carga_horaria_semanal,
            regimen_horario_id: t.regimen_horario_id,
          })),
        });
      }
    }
  }
  return rows;
}

async function crucePlanMensual(db, tramos, rango, grupoFilter) {
  if (!grupoFilter) return null;
  const snap = await db
    .collection(COL_PLANES)
    .where("grupo_id", "==", grupoFilter)
    .where("periodo", "==", rango.periodo)
    .where("estado", "==", "HABILITADO")
    .limit(5)
    .get();
  if (snap.empty) return { nota: "sin_plan_habilitado", grupo_id: grupoFilter, periodo: rango.periodo };
  const plan = snap.docs[0].data();
  const agentes = Array.isArray(plan.agentes) ? plan.agentes : [];
  const filas = [];
  for (const t of tramos) {
    const matches = agentes.filter((a) => String(a.persona_id || "") === t.persona_id);
    filas.push({
      persona_id: t.persona_id,
      hlg_tramo: t.hlg_id,
      entradas_plan_mismo_persona: matches.length,
      hlg_ids_en_plan: matches.map((a) => a.hlg_id || null),
      regimen_en_plan: matches.map((a) => a.regimen_horario_id || null),
      flag_plan_dedup_unico: matches.length === 1 && tramos.filter((x) => x.persona_id === t.persona_id).length >= 2,
    });
  }
  return { plan_id: snap.docs[0].id, filas };
}

function buildResumen(opts, personaId, hlgs, solapes, continuidad, tramosMes, visCruce, listadoInc, planCruce, rango) {
  const cont = {
    CONTIGUOUS: continuidad.filter((e) => e.tipo === "CONTIGUOUS").length,
    GAP: continuidad.filter((e) => e.tipo === "GAP").length,
    OVERLAP: continuidad.filter((e) => e.tipo === "OVERLAP").length,
  };
  const diasHuerfanos = continuidad.flatMap((e) => e.dias_huerfanos || []);
  const goFase2 = solapes.length === 0 && cont.OVERLAP === 0;

  return {
    generado_en: new Date().toISOString(),
    filtros: { dni: opts.dni || null, persona_id: personaId, grupo: opts.grupo || null, periodo: opts.periodo || null },
    hlg_leidas: hlgs.length,
    solapes_persona_grupo: solapes.length,
    solapes,
    continuidad: { ...cont, eventos: continuidad, dias_huerfanos_mes: diasHuerfanos.filter((d) => rango && d.startsWith(rango.periodo)) },
    tramos_en_mes: tramosMes,
    cruce_vis: visCruce,
    inconsistencia_listado_gso: listadoInc,
    cruce_plan_habilitado: planCruce,
    go_fase_2: goFase2,
    criterios_piloto: rango
      ? {
          tramos_esperados_min: 2,
          tramos_encontrados: tramosMes.length,
          overlap_esperado: 0,
          overlap_encontrado: solapes.length + cont.OVERLAP,
          contiguous_10_11: continuidad.some((e) => e.tipo === "CONTIGUOUS" && String(e.corte || "").includes("2026-06-10")),
        }
      : null,
  };
}

function renderMarkdown(resumen) {
  const lines = [
    "# Audit HLg vigencia — reporte",
    "",
    `Generado: ${resumen.generado_en}`,
    "",
    "## Filtros",
    "",
    "| Campo | Valor |",
    "|-------|-------|",
    `| persona_id | ${resumen.filtros.persona_id || "—"} |`,
    `| grupo | ${resumen.filtros.grupo || "—"} |`,
    `| periodo | ${resumen.filtros.periodo || "—"} |`,
    "",
    "## Resumen",
    "",
    "| Métrica | Valor |",
    "|---------|------:|",
    `| HLg leídas | ${resumen.hlg_leidas} |`,
    `| Solapes (Bloque A) | ${resumen.solapes_persona_grupo} |`,
    `| CONTIGUOUS | ${resumen.continuidad.CONTIGUOUS} |`,
    `| GAP | ${resumen.continuidad.GAP} |`,
    `| OVERLAP secuencial | ${resumen.continuidad.OVERLAP} |`,
    `| Tramos en mes | ${resumen.tramos_en_mes.length} |`,
    `| **Go Fase 2** | **${resumen.go_fase_2 ? "SÍ" : "NO"}** |`,
    "",
  ];

  if (resumen.tramos_en_mes.length) {
    lines.push("## Tramos en mes", "", "| hlg_id | vigente | carga | régimen |", "|--------|---------|------:|---------|");
    for (const t of resumen.tramos_en_mes) {
      lines.push(`| \`${t.hlg_id}\` | ${t.vigente_desde}–${t.vigente_hasta} | ${t.carga_horaria_semanal ?? "?"} | \`${t.regimen_horario_id || "?"}\` |`);
    }
    lines.push("");
  }

  if (resumen.continuidad.eventos.length) {
    lines.push("## Continuidad", "");
    for (const e of resumen.continuidad.eventos) {
      lines.push(`- **${e.tipo}** ${e.corte} (${e.hlg_a} → ${e.hlg_b})`);
      if (e.dias_huerfanos?.length) lines.push(`  - Días huérfanos: ${e.dias_huerfanos.join(", ")}`);
    }
    lines.push("");
  }

  if (resumen.cruce_vis.length) {
    lines.push("## Cruce vis_*", "");
    for (const v of resumen.cruce_vis) {
      lines.push(`### ${v.hlg_id} (${v.regimen_tipo_patron})`);
      for (const m of v.muestras_celdas) lines.push(`- ${m.ymd}: ${m.tipo} ${m.horario || ""}`);
      if (v.flags?.length) lines.push(`- ⚠ ${JSON.stringify(v.flags)}`);
      lines.push("");
    }
  }

  if (resumen.cruce_plan_habilitado?.plan_id) {
    lines.push("## Plan habilitado", "", `Plan: \`${resumen.cruce_plan_habilitado.plan_id}\``, "");
    for (const f of resumen.cruce_plan_habilitado.filas || []) {
      lines.push(`- ${f.persona_id}: ${f.entradas_plan_mismo_persona} entrada(s); hlg_ids=${JSON.stringify(f.hlg_ids_en_plan)}`);
    }
    lines.push("");
  }

  if (resumen.criterios_piloto) {
    lines.push("## Piloto", "", "```json", JSON.stringify(resumen.criterios_piloto, null, 2), "```", "");
  }

  return lines.join("\n");
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();

  const personaId = await resolvePersonaId(db, opts);
  if (opts.dni && !personaId) {
    console.error("Persona no encontrada para DNI", opts.dni);
    process.exit(1);
  }

  const hlgs = await loadHlgs(db, { ...opts, persona: personaId || opts.persona });
  const solapes = detectarSolapes(hlgs);
  const continuidad = detectarContinuidad(hlgs);

  let tramosMes = [];
  let visCruce = [];
  let listadoInc = [];
  let planCruce = null;
  const rango = opts.periodo ? rangoPeriodo(opts.periodo) : null;

  if (rango) {
    tramosMes = tramosEnMes(hlgs, rango);
    const diasHuerfanos = continuidad.flatMap((e) => e.dias_huerfanos || []);
    visCruce = await cruceVisTramos(db, tramosMes, rango, diasHuerfanos);
    listadoInc = await inconsistenciaListadoMes(db, hlgs, rango, opts.grupo);
    planCruce = await crucePlanMensual(db, tramosMes, rango, opts.grupo);
  }

  const resumen = buildResumen(opts, personaId, hlgs, solapes, continuidad, tramosMes, visCruce, listadoInc, planCruce, rango);

  if (opts.out) {
    const outPath = join(repoRoot, opts.out);
    mkdirSync(dirname(outPath), { recursive: true });
    if (opts.out.endsWith(".md")) {
      writeFileSync(outPath, renderMarkdown(resumen), "utf8");
    } else {
      writeFileSync(outPath, JSON.stringify(resumen, null, 2), "utf8");
    }
    console.error("Reporte:", outPath);
  }

  if (opts.json) {
    console.log(JSON.stringify(resumen, null, 2));
  } else {
    console.log("\n=== Audit HLg vigencia ===");
    console.log(`HLg analizadas: ${hlgs.length}`);
    console.log(`Solapes persona+grupo: ${solapes.length}`);
    console.log(`Continuidad: CONTIGUOUS=${resumen.continuidad.CONTIGUOUS} GAP=${resumen.continuidad.GAP} OVERLAP=${resumen.continuidad.OVERLAP}`);
    console.log(`Tramos en mes: ${tramosMes.length}`);
    console.log(`Go Fase 2: ${resumen.go_fase_2 ? "SÍ" : "NO"}`);
    for (const t of tramosMes) {
      console.log(`  ${t.hlg_id} · ${t.vigente_desde}–${t.vigente_hasta} · ${t.carga_horaria_semanal ?? "?"} hs · ${t.regimen_horario_id}`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

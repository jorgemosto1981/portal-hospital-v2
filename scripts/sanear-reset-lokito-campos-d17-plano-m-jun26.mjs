/**
 * Reset limpio LOKITO + CAMPOS · jun-2026 · Sala Internación 1.
 *
 * - Invalida TODOS los overrides_turno activos del gdt en d16 (LOKITO) y d17 (ambos).
 * - Purga capa fichada / analítica / presentación en vis_*.
 * - d17: fuerza turno teórico M simple (06:00–14:00, 2 fichadas esperadas).
 * - d16 LOKITO: rematerializa desde HLG (sin traslado).
 *
 * Uso:
 *   node scripts/sanear-reset-lokito-campos-d17-plano-m-jun26.mjs
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-reset-lokito-campos-d17-plano-m-jun26.mjs --apply
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

import { assertFirestoreSeedAllowed } from "./seed-v2/guard-no-seed.mjs";

const APPLY = process.argv.includes("--apply");
if (APPLY) {
  assertFirestoreSeedAllowed("sanear-reset-lokito-campos-d17-plano-m-jun26");
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { resolverCapaTeoricaGrupo } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"),
);
const { fusionarDiasDesdeClavesPlanas } = require(
  join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
);
const { buildCapaTeoricaSegmentada } = require(
  join(repoRoot, "functions/modules/asistencia/capaTeoricaSegmentosCore.js"),
);
const { getIndiceCalendario } = require(
  join(repoRoot, "functions/modules/shared/calendarService.js"),
);
const { enriquecerLimitesCumplimientoEnCapa } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaLimitesCumplimiento.js"),
);
const {
  materializarTurnoTeoricoDia,
  recalcularAnaliticaValidacionFichadaTrasTeoria,
} = require(join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"));

const SANACION_TAG = "sanear-reset-lokito-campos-d17-plano-m-jun26";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const CAMPOS = "per_01KR3GZX9TB33NHTE2QD5ZP13V";
const FECHA_D17 = "2026-06-17";
const FECHA_D16 = "2026-06-16";
const COL_ASI = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";
const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";

/** @type {Array<{ label: string, id: string, fechas: string[], forzarM?: boolean }>} */
const TRABAJOS = [
  { label: "LOKITO", id: LOKITO, fechas: [FECHA_D16, FECHA_D17], forzarM: true },
  { label: "CAMPOS", id: CAMPOS, fechas: [FECHA_D17], forzarM: true },
];

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
  return JSON.parse(readFileSync(gac, "utf8"));
}

/** @param {Record<string, unknown>|null|undefined} ov */
function overrideActivoEnGrupo(ov) {
  if (!ov || typeof ov !== "object") return false;
  if (ov.invalidado_por_replanificacion === true || ov.eliminado === true) return false;
  const g = String(ov.grupo_de_trabajo_id || ov.grupo_trabajo_id || "").trim();
  return g === GDT;
}

/** @param {Array<Record<string, unknown>>|null|undefined} overrides */
function invalidarOverridesGrupo(overrides) {
  const list = Array.isArray(overrides) ? overrides : [];
  let tocados = 0;
  const next = list.map((ov) => {
    if (!overrideActivoEnGrupo(ov)) return ov;
    tocados += 1;
    return {
      ...ov,
      invalidado_por_replanificacion: true,
      invalidado_en: new Date().toISOString(),
      invalidado_por_sanacion: SANACION_TAG,
    };
  });
  return { next, tocados };
}

/** @param {import("firebase-admin/firestore").Firestore} db @param {string} personaId */
async function resolverRegimen(db, personaId) {
  const hlgSnap = await db
    .collection(COL_HLG)
    .where("persona_id", "==", personaId)
    .where("grupo_de_trabajo_id", "==", GDT)
    .where("activo", "==", true)
    .limit(1)
    .get();
  const rid = hlgSnap.docs[0]?.data()?.regimen_horario_id;
  if (!rid) return null;
  const regSnap = await db.collection(COL_REGIMEN).doc(rid).get();
  return regSnap.exists ? regSnap.data() : null;
}

/**
 * Borra claves planas/nested de capa fichada y analítica del día en vis_*.
 * @param {import("firebase-admin/firestore").DocumentReference} visRef
 * @param {string} diaKey
 */
async function purgarCapaFichadaVisDia(visRef, diaKey) {
  const snap = await visRef.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  const prefix = `dias.${diaKey}.`;
  /** @type {unknown[]} */
  const args = [];
  for (const key of Object.keys(data)) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    if (
      suffix.startsWith("fichadas")
      || suffix === "capa_realidad"
      || suffix === "analitica_cumplimiento"
      || suffix === "presentacion_compuesto"
      || suffix === "validacion_fichada_dia"
      || suffix === "fichada_presencia"
      || suffix.startsWith("estado_fichada")
    ) {
      args.push(new FieldPath(key), FieldValue.delete());
    }
  }
  const nested = data.dias?.[diaKey];
  if (nested && typeof nested === "object") {
    const purgeNested = {};
    for (const k of Object.keys(nested)) {
      if (
        k.startsWith("fichadas")
        || k === "capa_realidad"
        || k === "analitica_cumplimiento"
        || k === "presentacion_compuesto"
        || k === "validacion_fichada_dia"
        || k === "fichada_presencia"
        || k.startsWith("estado_fichada")
      ) {
        purgeNested[`dias.${diaKey}.${k}`] = FieldValue.delete();
      }
    }
    if (Object.keys(purgeNested).length) {
      await visRef.update(purgeNested);
    }
  }
  if (args.length > 0) {
    await visRef.update(...args);
  }
}

/**
 * Escribe capa M + vis teórico + analítica limpia (sin fichadas).
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function forzarTurnoMDia({ db, personaId, fechaYmd, regimen }) {
  if (!regimen) throw new Error(`sin régimen para ${personaId}`);
  const indiceCalendario = await getIndiceCalendario();
  const capaRaw = buildCapaTeoricaSegmentada({
    fechaYmd,
    personaId,
    regimen,
    tipo_dia: "laborable",
    turnoCompuestoId: "M",
    origen_segmento: "sanacion_plano_m",
    indiceCalendario,
  });
  const capaSlice = enriquecerLimitesCumplimientoEnCapa(capaRaw, regimen);
  const asiId = buildAsiDocumentId(personaId, fechaYmd);
  const asiRef = db.collection(COL_ASI).doc(asiId);
  const asiSnap = await asiRef.get();
  const pathKey = `capa_teorica_por_grupo.${GDT}`;
  if (asiSnap.exists) {
    await asiRef.update({
      [pathKey]: capaSlice,
      [`analitica_cumplimiento_por_grupo.${GDT}`]: FieldValue.delete(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } else {
    await asiRef.set({
      persona_id: personaId,
      fecha: fechaYmd,
      capa_teorica_por_grupo: { [GDT]: capaSlice },
      overrides_turno: [],
    });
  }

  const [anio, mes] = fechaYmd.split("-").map(Number);
  const visId = buildVisDocumentId(personaId, `${fechaYmd.slice(0, 7)}-01`, GDT);
  const visRef = db.collection(COL_VIS).doc(visId);
  const diaKey = diaMesKeyDesdeYmd(fechaYmd);
  await purgarCapaFichadaVisDia(visRef, diaKey);

  const rec = await recalcularAnaliticaValidacionFichadaTrasTeoria({
    personaId,
    grupoId: GDT,
    fechaYmd,
    regimenDoc: regimen,
  });
  if (!rec?.ok) throw new Error(`recalcularAnalitica falló: ${rec?.motivo}`);

  // Tras persistirAnalitica se purgan claves planas del día: reescribir capa 1 en vis.
  const ingreso = String(capaSlice.ingreso || "06:00").slice(0, 5);
  const egreso = String(capaSlice.egreso || "14:00").slice(0, 5);
  await visRef.set(
    {
      persona_id: personaId,
      anio,
      mes,
      grupo_de_trabajo_id: GDT,
      [`dias.${diaKey}.rda_turno_id`]: "M",
      [`dias.${diaKey}.rda_ingreso`]: ingreso,
      [`dias.${diaKey}.rda_egreso`]: egreso,
      [`dias.${diaKey}.rda_tiene_huecos`]: FieldValue.delete(),
      [`dias.${diaKey}.rda_horario_display`]: FieldValue.delete(),
      [`dias.${diaKey}.fichadas_esperadas`]: capaSlice.fichadas_esperadas ?? 2,
      [`dias.${diaKey}.tipo_dia`]: "laborable",
      [`dias.${diaKey}.es_franco`]: false,
      [`dias.${diaKey}.es_feriado`]: capaSlice.es_feriado === true,
      [`dias.${diaKey}.grupo_de_trabajo_id`]: GDT,
    },
    { merge: true },
  );

  // Limpiar nested legacy que pisa la fusión si no hay clave plana previa.
  const visSnap = await visRef.get();
  const nested = visSnap.data()?.dias?.[diaKey];
  if (nested && typeof nested === "object") {
    const stale = {};
    for (const k of ["rda_turno_id", "rda_ingreso", "rda_egreso", "fichadas_esperadas", "rda_tiene_huecos", "rda_horario_display"]) {
      if (k in nested) stale[`dias.${diaKey}.${k}`] = FieldValue.delete();
    }
    if (Object.keys(stale).length) await visRef.update(stale);
  }

  return capaSlice;
}

/** @param {Record<string, unknown>|null|undefined} capa @param {string} pid */
function resumen(capa, pid) {
  const segs = Array.isArray(capa?.segmentos) ? capa.segmentos : [];
  return {
    turno: capa?.turno_compuesto_id ?? null,
    fichadas_esperadas: capa?.fichadas_esperadas ?? null,
    segmentos: segs.map((s) => ({
      id: s.segmento_id,
      propio: s.persona_titular_id === pid && s.persona_ejecutante_id === pid,
    })),
  };
}

/** @param {import("firebase-admin/firestore").Firestore} db @param {string} pid @param {string} fecha */
async function leerVis(db, pid, fecha) {
  const visId = buildVisDocumentId(pid, `${fecha.slice(0, 7)}-01`, GDT);
  const snap = await db.collection(COL_VIS).doc(visId).get();
  const c = fusionarDiasDesdeClavesPlanas(snap.data() || {})[fecha.slice(8, 10)] || {};
  return {
    rda_turno_id: c.rda_turno_id ?? null,
    fichadas_esperadas: c.fichadas_esperadas ?? null,
    fichadas_reales: c.fichadas_reales ?? null,
    semaforo: c.validacion_fichada_dia?.estado_semaforo ?? null,
  };
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const db = getFirestore();

console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`Sanación: ${SANACION_TAG}\n`);

console.log("--- ANTES ---");
for (const { label, id, fechas } of TRABAJOS) {
  for (const f of fechas) {
    console.log(`${label} ${f}:`, await leerVis(db, id, f));
  }
}

const plan = [];
for (const { label, id, fechas } of TRABAJOS) {
  for (const fecha of fechas) {
    const asiId = buildAsiDocumentId(id, fecha);
    const snap = await db.collection(COL_ASI).doc(asiId).get();
    const { tocados } = invalidarOverridesGrupo(snap.exists ? snap.data()?.overrides_turno : []);
    plan.push({ label, id, fecha, asiId, overridesInvalidados: tocados });
  }
}

console.log("\n--- Plan ---");
for (const row of plan) {
  console.log(`${row.label} ${row.fecha}: invalidar ${row.overridesInvalidados} override(s)`);
}

if (!APPLY) {
  console.log("\nDry-run OK. Para aplicar:");
  console.log(
    "  ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-reset-lokito-campos-d17-plano-m-jun26.mjs --apply",
  );
  process.exit(0);
}

console.log("\n--- Aplicando ---");
const regimenCache = new Map();

for (const row of plan) {
  const ref = db.collection(COL_ASI).doc(row.asiId);
  const snap = await ref.get();
  const { next, tocados } = invalidarOverridesGrupo(snap.data()?.overrides_turno || []);
  if (tocados > 0) {
    await ref.update({
      overrides_turno: next,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    console.log(`${row.label} ${row.fecha}: ${tocados} override(s) invalidados`);
  }
}

for (const { label, id, fechas, forzarM } of TRABAJOS) {
  let regimen = regimenCache.get(id);
  if (!regimen) {
    regimen = await resolverRegimen(db, id);
    regimenCache.set(id, regimen);
  }
  if (!regimen) {
    console.error(`FAIL: sin régimen ${label}`);
    process.exit(1);
  }

  for (const fecha of fechas) {
    const visId = buildVisDocumentId(id, `${fecha.slice(0, 7)}-01`, GDT);
    const diaKey = diaMesKeyDesdeYmd(fecha);
    await purgarCapaFichadaVisDia(db.collection(COL_VIS).doc(visId), diaKey);

    if (forzarM && fecha === FECHA_D17) {
      const capa = await forzarTurnoMDia({ db, personaId: id, fechaYmd: fecha, regimen });
      console.log(`${label} ${fecha}: turno M forzado`, resumen(capa, id));
    } else {
      const mat = await materializarTurnoTeoricoDia({
        personaId: id,
        grupoId: GDT,
        fechaYmd: fecha,
      });
      await recalcularAnaliticaValidacionFichadaTrasTeoria({
        personaId: id,
        grupoId: GDT,
        fechaYmd: fecha,
        regimenDoc: regimen,
      });
      const asi = await db.collection(COL_ASI).doc(buildAsiDocumentId(id, fecha)).get();
      const capa = resolverCapaTeoricaGrupo(asi.data(), GDT);
      console.log(`${label} ${fecha}: rematerializado`, {
        ok: mat.ok,
        ...resumen(capa, id),
      });
    }
  }
}

console.log("\n--- DESPUÉS ---");
let ok = true;
for (const { label, id, fechas } of TRABAJOS) {
  for (const f of fechas) {
    const v = await leerVis(db, id, f);
    console.log(`${label} ${f}:`, v);
    if (f === FECHA_D17) {
      if (v.rda_turno_id !== "M") {
        console.error(`FAIL ${label} d17: turno ${v.rda_turno_id} ≠ M`);
        ok = false;
      }
      if ((v.fichadas_esperadas ?? 0) !== 2) {
        console.error(`FAIL ${label} d17: fichadas_esperadas ${v.fichadas_esperadas}`);
        ok = false;
      }
      if (v.fichadas_reales != null && (Array.isArray(v.fichadas_reales) ? v.fichadas_reales.length : 0) > 0) {
        console.error(`FAIL ${label} d17: aún hay fichadas_reales`);
        ok = false;
      }
    }
  }
}

if (!ok) {
  console.error("\nFAIL validación post-reset.");
  process.exit(1);
}

console.log("\nPASS: LOKITO y CAMPOS d17 en M limpio; d16 LOKITO rematerializado sin traslado.");

/**
 * Fase 5 RFC LAO — Greenfield transaccional + parche configuración motor v2.
 *
 * Misión 1 (destrucción): solicitudes, impacto RDA/grilla, saldos, eventos MDC huérfanos.
 * Misión 2 (parche): versiones LAO — campos motor §11, codigo_grilla, fecha_corte_antiguedad.
 *
 * Uso (raíz, credencial en .env.v2.local):
 *   node scripts/greenfield-reset-lao-v2.mjs
 *   node scripts/greenfield-reset-lao-v2.mjs --apply --confirm-nuclear
 *   node scripts/greenfield-reset-lao-v2.mjs --only-config
 *   node scripts/greenfield-reset-lao-v2.mjs --apply --confirm-nuclear --rda=personas --dni=28914247
 *   node scripts/greenfield-reset-lao-v2.mjs --apply --confirm-nuclear --rda=all --saldos=all
 *
 * Ref: docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §13
 */
import { FieldPath } from "firebase-admin/firestore";

import { getAdminDb, resolveProjectId } from "./lib/firestoreAdminBootstrap.mjs";

const COL_SOL = "solicitudes_articulo";
const COL_ASI = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";
const COL_SALDOS = "saldos_articulo_agente";
const COL_EVENTOS = "eventos_ticket";
const COL_MDC_IDEM = "mdc_comandos_aplicados";
const SUB_EVENTOS = "eventos_ticket";

const RX_SOL = /^sol_[0-9A-HJKMNP-TV-Z]{26}$/i;
const RX_PER = /^per_[0-9A-HJKMNP-TV-Z]{26}$/i;
const FECHA_CORTE_LEGACY = "2000-12-31";

const MOTOR_DEFAULTS = {
  mes_dia_apertura_solicitudes: "07-01",
  tse_minimo_dias_base: 180,
  permite_calculo_proporcional_tse: true,
};

const CODIGO_GRILLA_LAO = "LAO";

const args = new Set(process.argv.slice(2));

function flag(name, fallback = false) {
  return args.has(name) ? true : fallback;
}

function opt(name, fallback) {
  for (const a of args) {
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
  }
  return fallback;
}

const APPLY = flag("--apply");
const CONFIRM = flag("--confirm-nuclear");
const ONLY_CONFIG = flag("--only-config");
const ONLY_DESTROY = flag("--only-destroy");
const RDA_MODE = opt("--rda", "linked");
const SALDOS_MODE = opt("--saldos", "all");
const SKIP_EVENTOS = flag("--skip-eventos");
const SKIP_MDC = flag("--skip-mdc-idempotencia");

const dniList = (opt("--dni", "") || "")
  .split(",")
  .map((s) => s.replace(/\D/g, ""))
  .filter(Boolean);
const personaList = (opt("--persona", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => RX_PER.test(s));

if (!["linked", "personas", "all"].includes(RDA_MODE)) {
  console.error("--rda debe ser linked | personas | all");
  process.exit(1);
}
if (!["none", "personas", "all"].includes(SALDOS_MODE)) {
  console.error("--saldos debe ser none | personas | all");
  process.exit(1);
}

/** @type {Record<string, number>} */
const plan = {
  solicitudes: 0,
  eventos_sol_sub: 0,
  eventos_top: 0,
  mdc_idempotencia: 0,
  asistencia_diaria: 0,
  vistas_grilla: 0,
  saldos: 0,
  versiones_patch: 0,
};

/** @param {FirebaseFirestore.Firestore} db */
async function resolvePersonaIds(db) {
  const ids = new Set(personaList);
  for (const dni of dniList) {
    const snap = await db.collection("personas").where("dni", "==", dni).limit(3).get();
    if (snap.empty) {
      console.warn(`[warn] Sin persona para DNI ${dni}`);
      continue;
    }
    if (snap.size > 1) {
      console.warn(`[warn] DNI ${dni} tiene ${snap.size} personas; se usa la primera.`);
    }
    ids.add(snap.docs[0].id);
  }
  return [...ids];
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference[]} refs
 */
async function deleteRefs(db, refs) {
  const CHUNK = 400;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + CHUNK)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} col
 */
async function listAllDocRefs(db, col) {
  /** @type {FirebaseFirestore.DocumentReference[]} */
  const refs = [];
  let last = null;
  for (;;) {
    let q = db.collection(col).orderBy(FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) refs.push(d.ref);
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  return refs;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function collectSolicitudRefs(db) {
  return listAllDocRefs(db, COL_SOL);
}

/**
 * @param {unknown} aportes
 * @returns {boolean}
 */
function asiTieneAporteSol(aportes) {
  if (!aportes || typeof aportes !== "object") return false;
  return Object.keys(aportes).some((k) => RX_SOL.test(k));
}

/**
 * @param {unknown} dias
 * @returns {boolean}
 */
function visTieneSolicitud(dias) {
  if (!dias || typeof dias !== "object") return false;
  for (const row of Object.values(dias)) {
    if (row && typeof row === "object" && RX_SOL.test(String(/** @type {{ solicitud_id?: string }} */ (row).solicitud_id || ""))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} personaIds
 */
async function collectRdaRefs(db, personaIds) {
  /** @type {FirebaseFirestore.DocumentReference[]} */
  const asiRefs = [];
  /** @type {FirebaseFirestore.DocumentReference[]} */
  const visRefs = [];

  if (RDA_MODE === "all") {
    return {
      asiRefs: await listAllDocRefs(db, COL_ASI),
      visRefs: await listAllDocRefs(db, COL_VIS),
    };
  }

  const personaSet = new Set(personaIds);

  let last = null;
  for (;;) {
    let q = db.collection(COL_ASI).orderBy(FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const pid = String(data.persona_id || "");
      const matchPersona = RDA_MODE === "personas" && personaSet.has(pid);
      const matchLinked = RDA_MODE === "linked" && asiTieneAporteSol(data.aportes_normativos);
      if (matchPersona || matchLinked) asiRefs.push(doc.ref);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }

  last = null;
  for (;;) {
    let q = db.collection(COL_VIS).orderBy(FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const pid = String(data.persona_id || "");
      const matchPersona = RDA_MODE === "personas" && personaSet.has(pid);
      const matchLinked = RDA_MODE === "linked" && visTieneSolicitud(data.dias);
      if (matchPersona || matchLinked) visRefs.push(doc.ref);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }

  return { asiRefs, visRefs };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} personaIds
 */
async function collectSaldosRefs(db, personaIds) {
  if (SALDOS_MODE === "none") return [];
  const all = await listAllDocRefs(db, COL_SALDOS);
  if (SALDOS_MODE === "all") return all;

  const suffixes = personaIds.map((pid) => `_per_${pid.replace(/^per_/i, "")}`);
  return all.filter((ref) => suffixes.some((suf) => ref.id.endsWith(suf) || ref.id === `sal_global${suf}`));
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference[]} solRefs
 */
async function collectEventosTopRefs(db, solRefs) {
  if (SKIP_EVENTOS) return [];
  const solIds = new Set(solRefs.map((r) => r.id));
  /** @type {FirebaseFirestore.DocumentReference[]} */
  const refs = [];
  const snap = await db.collection(COL_EVENTOS).get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const sid = String(d.solicitud_id || d.sol_id || "").trim();
    if (sid && solIds.has(sid)) refs.push(doc.ref);
  }
  return refs;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function collectMdcIdempotenciaRefs(db) {
  if (SKIP_MDC) return [];
  const snap = await db.collection(COL_MDC_IDEM).get();
  return snap.docs.filter((d) => d.id.includes("sol_")).map((d) => d.ref);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference[]} solRefs
 */
async function countSubEventos(db, solRefs) {
  let n = 0;
  for (const ref of solRefs) {
    const sub = await ref.collection(SUB_EVENTOS).get();
    n += sub.size;
  }
  return n;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function mission2PatchConfig(db) {
  const artsSnap = await db.collection("cfg_articulos").get();
  /** @type {{ artId: string, verId: string, patch: Record<string, unknown> }[]} */
  const patches = [];

  for (const artDoc of artsSnap.docs) {
    const verSnap = await artDoc.ref.collection("versiones").get();
    for (const vdoc of verSnap.docs) {
      const data = vdoc.data() || {};
      const ident = data.bloque_identidad_naturaleza;
      if (!ident || ident.es_lao_anual !== true) continue;

      const topes = { ...(data.bloque_topes_plazos_computo || {}) };
      const vis = { ...(ident.visualizacion || {}) };
      /** @type {Record<string, unknown>} */
      const patch = {};
      let changed = false;

      for (const [k, v] of Object.entries(MOTOR_DEFAULTS)) {
        if (topes[k] == null || topes[k] === "") {
          topes[k] = v;
          changed = true;
        }
      }
      if (String(topes.fecha_corte_antiguedad || "").slice(0, 10) === FECHA_CORTE_LEGACY) {
        topes.fecha_corte_antiguedad = null;
        changed = true;
      }
      if (!vis.codigo_grilla || String(vis.codigo_grilla).trim() === "") {
        vis.codigo_grilla = CODIGO_GRILLA_LAO;
        changed = true;
      }

      if (changed) {
        patch.bloque_topes_plazos_computo = topes;
        patch.bloque_identidad_naturaleza = { ...ident, visualizacion: vis };
        patches.push({ artId: artDoc.id, verId: vdoc.id, patch });
      }
    }
  }

  plan.versiones_patch = patches.length;

  if (!APPLY) {
    for (const p of patches) {
      console.log(`  [patch] ${p.artId} / ${p.verId}`);
    }
    return;
  }

  const BATCH = 400;
  let batch = db.batch();
  let ops = 0;
  const commits = [];
  for (const p of patches) {
    const ref = db.collection("cfg_articulos").doc(p.artId).collection("versiones").doc(p.verId);
    batch.update(ref, p.patch);
    ops += 1;
    if (ops >= BATCH) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} personaIds
 */
async function mission1Destroy(db, personaIds) {
  const solRefs = await collectSolicitudRefs(db);
  plan.solicitudes = solRefs.length;
  plan.eventos_sol_sub = await countSubEventos(db, solRefs);

  const eventosTopRefs = await collectEventosTopRefs(db, solRefs);
  plan.eventos_top = eventosTopRefs.length;

  const mdcRefs = await collectMdcIdempotenciaRefs(db);
  plan.mdc_idempotencia = mdcRefs.length;

  const { asiRefs, visRefs } = await collectRdaRefs(db, personaIds);
  plan.asistencia_diaria = asiRefs.length;
  plan.vistas_grilla = visRefs.length;

  const saldosRefs = await collectSaldosRefs(db, personaIds);
  plan.saldos = saldosRefs.length;

  if (!APPLY) return;

  console.log("\n[APPLY] Borrando eventos top-level ligados a sol_* …");
  await deleteRefs(db, eventosTopRefs);

  console.log("[APPLY] Borrando mdc_comandos_aplicados (sol_*) …");
  await deleteRefs(db, mdcRefs);

  console.log("[APPLY] Borrando solicitudes_articulo (+ subcolección eventos) …");
  for (const ref of solRefs) {
    await db.recursiveDelete(ref);
  }

  console.log("[APPLY] Borrando asistencia_diaria …");
  await deleteRefs(db, asiRefs);

  console.log("[APPLY] Borrando vistas_grilla_mes_agente …");
  await deleteRefs(db, visRefs);

  console.log("[APPLY] Borrando saldos_articulo_agente …");
  await deleteRefs(db, saldosRefs);
}

async function main() {
  const db = getAdminDb();
  const projectId = resolveProjectId();
  const personaIds = await resolvePersonaIds(db);

  console.log("=== Greenfield reset LAO V2 (Fase 5) ===");
  console.log(`Proyecto: ${projectId}`);
  console.log(`Modo: ${APPLY && CONFIRM ? "APPLY" : "DRY-RUN"}`);
  console.log(`Misión 1 (destrucción): ${ONLY_CONFIG ? "omitida" : "sí"}`);
  console.log(`Misión 2 (config): ${ONLY_DESTROY ? "omitida" : "sí"}`);
  console.log(`RDA: ${RDA_MODE} | Saldos: ${SALDOS_MODE}`);
  if (personaIds.length) console.log(`Personas piloto: ${personaIds.join(", ")}`);
  console.log("");

  if (APPLY && !CONFIRM) {
    console.error("Para escribir en Firestore usá --apply --confirm-nuclear");
    process.exit(1);
  }

  if (RDA_MODE === "personas" && personaIds.length === 0) {
    console.warn("[warn] --rda=personas sin --dni ni --persona: no se borrará RDA por persona.");
  }
  if (SALDOS_MODE === "personas" && personaIds.length === 0) {
    console.warn("[warn] --saldos=personas sin --dni ni --persona: no se borrarán saldos.");
  }

  if (!ONLY_CONFIG) {
    await mission1Destroy(db, personaIds);
  }

  if (!ONLY_DESTROY) {
    console.log("\n--- Misión 2: parche versiones LAO (es_lao_anual) ---");
    await mission2PatchConfig(db);
  }

  console.log("\n[plan resumen]");
  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) {
    console.log("\n[DRY-RUN] Sin cambios. Re-ejecutá con --apply --confirm-nuclear");
    if (RDA_MODE === "linked" && plan.asistencia_diaria === 0 && plan.solicitudes > 0) {
      console.log(
        "[tip] Si la grilla sigue ocupada tras borrar sol_*, repetí con --rda=personas --dni=… o --rda=all",
      );
    }
  } else {
    console.log("\n[OK] Greenfield aplicado. Siguiente: check-in saldos + primera solicitud LAO v2.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

"use strict";

const { FieldValue } = require("./context");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_AUTORIZAR_JEFE,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
} = require("./solicitudesArticuloEstados");
const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd, vigenteEnFechaInclusivaYmd } = require("./fechaLaboralYmd");

const COL_SOL = "solicitudes_articulo";
const COL_HLG = "historial_laboral_grupos";
const COL_PERSONAS = "personas";
const COL_CFG_ART = "cfg_articulos";
const LIST_LIMIT = 80;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {Map<string, { codigo_grilla: string, nombre: string, articulo_label: string }>} cache
 */
async function loadArticuloDisplay(db, articuloId, cache) {
  const id = String(articuloId || "").trim();
  if (!id) {
    return { codigo_grilla: "", nombre: "", articulo_label: "Solicitud" };
  }
  if (cache.has(id)) return cache.get(id);

  const snap = await db.collection(COL_CFG_ART).doc(id).get();
  const core = snap.exists ? snap.data() || {} : {};
  const codigo_grilla = String(core.codigo || core.nombre_corto || "").trim();
  const nombre = String(core.nombre || core.codigo || "").trim();
  let articulo_label = "Artículo";
  if (codigo_grilla && nombre) articulo_label = `${codigo_grilla} — ${nombre}`;
  else articulo_label = codigo_grilla || nombre || id;

  const row = { codigo_grilla, nombre, articulo_label };
  cache.set(id, row);
  return row;
}

/**
 * @param {Record<string, unknown>} hlg
 * @param {string} fechaRefYmd
 */
function hlgVigenteEnFecha(hlg, fechaRefYmd) {
  if (!hlg || hlg.activo === false) return false;
  return vigenteEnFechaInclusivaYmd(hldHlgFechaInicioYmd(hlg), hldHlgFechaFinYmd(hlg) || null, fechaRefYmd);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 */
async function loadHlgRows(db, personaId) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) return [];
  const snap = await db.collection(COL_HLG).where("persona_id", "==", pid).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * Nivel menor = mayor jerarquía (1 más alto que 99).
 * @param {Array<Record<string, unknown>>} jefeHlg
 * @param {Array<Record<string, unknown>>} titularHlg
 * @param {string} fechaRefYmd
 */
function esSubordinadoPorHlg(jefeHlg, titularHlg, fechaRefYmd) {
  const jefeV = jefeHlg.filter((h) => hlgVigenteEnFecha(h, fechaRefYmd));
  const titV = titularHlg.filter((h) => hlgVigenteEnFecha(h, fechaRefYmd));
  for (const t of titV) {
    const gid = String(t.grupo_de_trabajo_id || "").trim();
    const tNivel = Number(t.nivel_jerarquico);
    if (!gid || !Number.isFinite(tNivel)) continue;
    for (const j of jefeV) {
      if (String(j.grupo_de_trabajo_id || "").trim() !== gid) continue;
      const jNivel = Number(j.nivel_jerarquico);
      if (!Number.isFinite(jNivel)) continue;
      if (jNivel < tNivel) return true;
    }
  }
  return false;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} jefePersonaId
 * @param {string} titularPersonaId
 * @param {string} fechaRefYmd
 * @param {boolean} rrhhBypass
 */
async function puedeGestionarSolicitud(db, jefePersonaId, titularPersonaId, fechaRefYmd, rrhhBypass) {
  if (rrhhBypass) return true;
  if (jefePersonaId === titularPersonaId) return false;
  const [jefeHlg, titHlg] = await Promise.all([
    loadHlgRows(db, jefePersonaId),
    loadHlgRows(db, titularPersonaId),
  ]);
  return esSubordinadoPorHlg(jefeHlg, titHlg, fechaRefYmd);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ revisorPersonaId: string, rrhhBypass: boolean }} opts
 */
async function listarSolicitudesBandejaJefe(db, opts) {
  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_EN_REVISION_JEFE)
    .limit(LIST_LIMIT)
    .get();

  const candidatas = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const out = [];
  const personaCache = new Map();
  const articuloCache = new Map();

  for (const sol of candidatas) {
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;

    const ok = await puedeGestionarSolicitud(
      db,
      opts.revisorPersonaId,
      titularId,
      fechaRef,
      opts.rrhhBypass,
    );
    if (!ok) continue;

    let titularLabel = personaCache.get(titularId);
    if (titularLabel === undefined) {
      const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
      const p = pSnap.exists ? pSnap.data() || {} : {};
      const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
      titularLabel = nom || titularId;
      personaCache.set(titularId, titularLabel);
    }

    const artId = String(sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);

    out.push({
      solicitud_id: sol.id,
      articulo_id: artId,
      articulo_label: artDisplay.articulo_label,
      codigo_grilla: artDisplay.codigo_grilla,
      articulo_nombre: artDisplay.nombre,
      titular_persona_id: titularId,
      titular_label: titularLabel,
      fecha_desde: fechaRef,
      fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
      dias_solicitados: Number(sol.dias_solicitados) || 1,
      patron_saldo: String(sol.patron_saldo || ""),
      estado_solicitud_id: sol.estado_solicitud_id,
      creado_en: sol.creado_en || null,
    });
  }

  out.sort((a, b) => String(b.fecha_desde).localeCompare(String(a.fecha_desde)));
  return { solicitudes: out, limite: LIST_LIMIT };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 * @param {boolean} rrhhBypass
 */
async function resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, rrhhBypass) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está en revisión por jefe." };
  }

  const titularId = String(sol.titular_persona_id || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  const puede = await puedeGestionarSolicitud(db, revisorPersonaId, titularId, fechaRef, rrhhBypass);
  if (!puede) {
    return { ok: false, codigo: "PERMISSION_DENIED", mensaje: "No podés gestionar esta solicitud." };
  }

  if (decision === "aprobar") {
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_RRHH,
      jefe_revision_persona_id: revisorPersonaId,
      jefe_revision_en: FieldValue.serverTimestamp(),
      jefe_motivo: motivo || null,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(db, solId, {
      ...sol,
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_RRHH,
      codigo_grilla: artDisplay.codigo_grilla,
    }, MDC_COMANDO_AUTORIZAR_JEFE);
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_RRHH,
    };
  }

  if (decision === "rechazar") {
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: motivo || null,
        motor_reverso_jefe_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(db, solId, {
      ...sol,
      codigo_grilla: artDisplay.codigo_grilla,
    }, MDC_COMANDO_REVERTIR_PROYECCION);

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

module.exports = {
  listarSolicitudesBandejaJefe,
  resolverDecisionJefeSolicitud,
  puedeGestionarSolicitud,
  esSubordinadoPorHlg,
  loadArticuloDisplay,
};

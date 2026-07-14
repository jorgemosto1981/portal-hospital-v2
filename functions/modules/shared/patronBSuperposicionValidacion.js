"use strict";

const { CODIGO_SUPERPOSICION, mensajeParaCodigo } = require("./solicitudElegibilidadLaboral");
const { iterarYmdInclusive, buildAsiDocumentId } = require("./mdcRdaDocumentIds");
const { COL_ASISTENCIA_DIARIA } = require("./mdcComandosConstants");
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
  ESTADO_SOLICITUD_RECHAZADA,
} = require("./solicitudesArticuloEstados");

const CFG_POLITICA_SUPERPOSICION_BLOQUEANTE = "cfg_ps_bloqueante";

const ESTADOS_SOLICITUD_OCUPAN_FECHA = new Set([
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
]);

/**
 * @param {string} d1
 * @param {string} h1
 * @param {string} d2
 * @param {string} h2
 */
function rangosYmdSeSolapan(d1, h1, d2, h2) {
  const a = String(d1 || "").slice(0, 10);
  const b = String(h1 || d1 || "").slice(0, 10);
  const c = String(d2 || "").slice(0, 10);
  const d = String(h2 || d2 || "").slice(0, 10);
  if (!a || !c) return false;
  return a <= d && c <= b;
}

/**
 * @param {string} ymd
 */
function ymdToDdMmYyyy(ymd) {
  const s = String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * @param {string | null | undefined} estadoId
 */
function labelEstadoConflicto(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === ESTADO_SOLICITUD_BORRADOR) return "Borrador";
  if (e === ESTADO_SOLICITUD_EN_REVISION_JEFE) return "Pendiente de autorización (jefe)";
  if (e === ESTADO_SOLICITUD_EN_REVISION_RRHH) return "Pendiente de autorización (RRHH)";
  if (e === ESTADO_SOLICITUD_APROBADA) return "Autorizada";
  if (e === ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION) {
    return "Autorizada · pendiente de aplicar en grilla";
  }
  if (e.includes("clasificacion_medica")) return "Pendiente de clasificación médica";
  if (e.includes("junta")) return "Esperando junta médica";
  return e || "En trámite";
}

/**
 * @param {Record<string, unknown>} sol
 * @param {string} [codigoGrilla]
 */
function etiquetaTramiteConflicto(sol, codigoGrilla) {
  if (sol?.es_cambio_dia === true) return "Cambio de Día de Asistencia";
  if (String(sol?.schema_version || "") === "SOL_MED_AVISO_V1") return "Aviso de licencia médica";
  const cod = String(codigoGrilla || sol?.codigo_grilla || "").trim();
  if (cod) return cod.length <= 12 ? `Art. ${cod}` : cod;
  return "Solicitud";
}

/**
 * @param {string} desde
 * @param {string} hasta
 */
function textoRangoConflicto(desde, hasta) {
  const d = ymdToDdMmYyyy(desde);
  const h = ymdToDdMmYyyy(hasta);
  if (d && h && d !== h) return `${d} → ${h}`;
  return d || h || "";
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {Record<string, unknown> | null} [solPre]
 * @param {{ fuente?: string }} [opts]
 */
async function buildMensajeConflictoSuperposicion(db, solId, solPre, opts = {}) {
  const base = mensajeParaCodigo(CODIGO_SUPERPOSICION);
  const id = String(solId || "").trim();
  let sol = solPre && typeof solPre === "object" ? solPre : null;

  if (!sol && /^sol_/i.test(id)) {
    try {
      const snap = await db.collection("solicitudes_articulo").doc(id).get();
      if (snap.exists) sol = snap.data() || {};
    } catch {
      sol = null;
    }
  }

  if (!sol) {
    if (opts.fuente === "asistencia_diaria") {
      return `${base} Hay una ausencia/licencia ya aplicada en la grilla ese día.`;
    }
    return base;
  }

  let codigoGrilla = String(sol.codigo_grilla || "").trim();
  const artId = String(sol.articulo_id || "").trim();
  if (!codigoGrilla && /^art_/i.test(artId)) {
    try {
      const aSnap = await db.collection("cfg_articulos").doc(artId).get();
      if (aSnap.exists) {
        const a = aSnap.data() || {};
        codigoGrilla = String(a.codigo_grilla || a.codigo || "").trim();
      }
    } catch {
      /* ignore */
    }
  }

  const tramite = etiquetaTramiteConflicto(sol, codigoGrilla);
  const fd = String(sol.fecha_desde || sol.fecha_origen || "").slice(0, 10);
  const fh = String(sol.fecha_hasta || sol.fecha_destino || sol.fecha_desde || "").slice(0, 10);
  const rango = textoRangoConflicto(fd, fh);
  const estado = labelEstadoConflicto(sol.estado_solicitud_id);
  const detalle = [tramite, rango ? `(${rango})` : "", `· ${estado}`].filter(Boolean).join(" ");

  return `Ya hay un trámite que ocupa esa fecha: ${detalle}. Esperá la resolución o contactá a RRHH.`;
}

/**
 * Política BLOQUEANTE (`cfg_ps_bloqueante`): rechaza alta si otra solicitud activa
 * o un aporte en `asistencia_diaria` ya ocupa algún día del rango.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta?: string,
 *   exclude_sol_id?: string,
 *   version_data: Record<string, unknown> | null | undefined,
 * }} input
 */
async function validarSuperposicionFechasPatronB(db, input) {
  const topes =
    input?.version_data && typeof input.version_data === "object"
      ? input.version_data.bloque_topes_plazos_computo || {}
      : {};
  const politicaId = String(topes.politica_superposicion_id || "").trim();
  if (politicaId !== CFG_POLITICA_SUPERPOSICION_BLOQUEANTE) {
    return { ok: true };
  }

  const personaId = String(input.persona_id || "").trim();
  const desde = String(input.fecha_desde || "").slice(0, 10);
  const hasta = String(input.fecha_hasta || input.fecha_desde || "").slice(0, 10);
  const excludeSolId = String(input.exclude_sol_id || "").trim();
  if (!personaId || !desde) {
    return { ok: true };
  }

  const diasPedido = iterarYmdInclusive(desde, hasta);
  if (!diasPedido.length) {
    return { ok: true };
  }

  const snap = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", personaId)
    .get();

  for (const doc of snap.docs) {
    if (excludeSolId && doc.id === excludeSolId) continue;
    const s = doc.data() || {};
    const estado = String(s.estado_solicitud_id || "").trim();
    if (estado === ESTADO_SOLICITUD_RECHAZADA || !ESTADOS_SOLICITUD_OCUPAN_FECHA.has(estado)) {
      continue;
    }
    const fd = String(s.fecha_desde || "").slice(0, 10);
    const fh = String(s.fecha_hasta || s.fecha_desde || "").slice(0, 10);
    if (rangosYmdSeSolapan(desde, hasta, fd, fh)) {
      const mensaje = await buildMensajeConflictoSuperposicion(db, doc.id, s);
      return {
        ok: false,
        codigo: CODIGO_SUPERPOSICION,
        mensaje,
        conflicto_solicitud_id: doc.id,
        conflicto_estado_solicitud_id: estado,
      };
    }
  }

  for (const ymd of diasPedido) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    if (!asiId) continue;
    const asiSnap = await db.collection(COL_ASISTENCIA_DIARIA).doc(asiId).get();
    if (!asiSnap.exists) continue;
    const aportes = asiSnap.data()?.aportes_normativos;
    if (!aportes || typeof aportes !== "object") continue;
    for (const solKey of Object.keys(aportes)) {
      if (excludeSolId && solKey === excludeSolId) continue;
      const mensaje = await buildMensajeConflictoSuperposicion(db, solKey, null, {
        fuente: "asistencia_diaria",
      });
      return {
        ok: false,
        codigo: CODIGO_SUPERPOSICION,
        mensaje,
        conflicto_solicitud_id: solKey,
        conflicto_fuente: "asistencia_diaria",
      };
    }
  }

  return { ok: true };
}

module.exports = {
  validarSuperposicionFechasPatronB,
  buildMensajeConflictoSuperposicion,
  CFG_POLITICA_SUPERPOSICION_BLOQUEANTE,
  ESTADOS_SOLICITUD_OCUPAN_FECHA,
  rangosYmdSeSolapan,
};

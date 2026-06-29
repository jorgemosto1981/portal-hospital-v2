"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const {
  CFG_EPL_ABIERTO,
  CFG_EPL_LIQUIDADO_CERRADO,
} = require("../shared/cfgAsistenciaTurnosIds");

const COL_VIS = "vistas_grilla_mes_agente";

const CODIGO_PERIODO_CERRADO = "ASI-PER-001";
const MSG_PERIODO_CERRADO =
  "Período de liquidación cerrado para el sector/período seleccionado.";
const COL_GDT = "grupos_de_trabajo";

const { iterarYmdInclusive } = require("../shared/mdcRdaDocumentIds");
const { contarPersonasVigentesGrupoMes } = require("../shared/grillaMesAgenteCore");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
} = require("../shared/solicitudesArticuloEstados");

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId gdt_* — obligatorio (vis scoped)
 * @returns {Promise<{ cerrado: boolean, estado_periodo_liquidacion_id: string|null }>}
 */
async function consultarEstadoPeriodoLiquidacion(firestore, personaId, fechaYmd, grupoTrabajoId) {
  const visId = buildVisDocumentId(personaId, fechaYmd, grupoTrabajoId);
  const snap = await firestore.collection(COL_VIS).doc(visId).get();
  if (!snap.exists) return { cerrado: false, estado_periodo_liquidacion_id: null };
  const id = snap.data()?.estado_periodo_liquidacion_id || null;
  return {
    cerrado: id === CFG_EPL_LIQUIDADO_CERRADO,
    estado_periodo_liquidacion_id: id,
  };
}

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId gdt_*
 * @returns {Promise<void>}
 */
function formatPeriodoYm(fechaYmd) {
  const ymd = String(fechaYmd || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd.slice(0, 7) : "YYYY-MM";
}

/**
 * @param {import("firebase-admin/firestore").Firestore} firestore
 * @param {string} grupoTrabajoId
 */
async function etiquetaGrupoTrabajo(firestore, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return gdt || "sector";
  const snap = await firestore.collection(COL_GDT).doc(gdt).get();
  if (!snap.exists) return gdt;
  const d = snap.data() || {};
  return String(d.nombre || d.codigo || d.titulo || "").trim() || gdt;
}

async function periodoCerradoError(firestore, { grupoTrabajoId, fechaYmd } = {}) {
  const gdt = String(grupoTrabajoId || "").trim() || "gdt_*";
  const periodo = formatPeriodoYm(fechaYmd);
  const sectorLabel = firestore ? await etiquetaGrupoTrabajo(firestore, gdt) : gdt;
  const detalle =
    `No se puede continuar porque el período ${periodo} está cerrado para ${sectorLabel}. ` +
    "Elegí otro mes/sector o solicitá a RRHH la reapertura del período.";
  const err = new Error(`[${CODIGO_PERIODO_CERRADO}] ${detalle}`);
  err.code = "failed-precondition";
  return err;
}

async function assertPeriodoNoCerrado(firestore, personaId, fechaYmd, grupoTrabajoId) {
  const { cerrado } = await consultarEstadoPeriodoLiquidacion(firestore, personaId, fechaYmd, grupoTrabajoId);
  if (cerrado) {
    throw await periodoCerradoError(firestore, { grupoTrabajoId, fechaYmd });
  }
}

function esEstadoSolicitudEnTramite(estadoSolicitudId) {
  const est = String(estadoSolicitudId || "").trim();
  return (
    est === ESTADO_SOLICITUD_EN_REVISION_JEFE ||
    est === ESTADO_SOLICITUD_EN_REVISION_RRHH ||
    est === ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA
  );
}

/**
 * Bloquea altas nuevas (validar entorno / proyección inicial) si algún mes del rango está cerrado en el gdt.
 */
async function assertNuevaSolicitudNoEnPeriodoCerrado(firestore, personaId, fechaDesde, fechaHasta, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return;
  const desde = String(fechaDesde || "").slice(0, 10);
  const hasta = String(fechaHasta || desde).slice(0, 10);
  const meses = new Set();
  for (const ymd of iterarYmdInclusive(desde, hasta)) {
    meses.add(ymd.slice(0, 7));
  }
  for (const _mes of meses) {
    const probe = `${_mes}-01`;
    const { cerrado } = await consultarEstadoPeriodoLiquidacion(firestore, personaId, probe, gdt);
    if (cerrado) throw await periodoCerradoError(firestore, { grupoTrabajoId: gdt, fechaYmd: probe });
  }
}

/**
 * Cierra liquidación de todas las vis_* del grupo en el mes (RRHH).
 * @param {import("firebase-admin/firestore").Firestore} firestore
 */
async function cerrarPeriodoLiquidacionCore(
  firestore,
  { grupoTrabajoId, anio, mes, actorPersonaId, motivo },
) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", actualizados: 0 };
  }

  const snap = await firestore
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("anio", "==", y)
    .where("mes", "==", m)
    .get();

  if (snap.empty) {
    return { ok: true, actualizados: 0, grupo_trabajo_id: gdt, anio: y, mes: m };
  }

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  const actor = String(actorPersonaId || "").trim() || null;
  const motivoTxt = motivo ? String(motivo).trim().slice(0, 500) : null;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      estado_periodo_liquidacion_id: CFG_EPL_LIQUIDADO_CERRADO,
      periodo_cerrado_en: now,
      periodo_cerrado_por_persona_id: actor,
      periodo_cierre_motivo: motivoTxt,
    });
  }
  await batch.commit();

  return {
    ok: true,
    actualizados: snap.size,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
  };
}

/**
 * Reabre período (solo RRHH, con motivo).
 */
/**
 * Estado de liquidación del sector en un mes (muestra de un vis_* del grupo).
 * @param {import("firebase-admin/firestore").Firestore} firestore
 */
async function consultarPeriodoLiquidacionGrupoMes(firestore, params) {
  const p = params && typeof params === "object" ? params : {};
  const gdt = String(p.grupoTrabajoId || p.grupo_trabajo_id || "").trim();
  const anio = p.anio;
  const mes = p.mes;
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return {
      ok: false,
      cerrado: false,
      existe: false,
      personas_vigentes: 0,
      grupo_trabajo_id: gdt,
      anio: y,
      mes: m,
    };
  }
  const personas_vigentes = await contarPersonasVigentesGrupoMes(firestore, {
    grupoTrabajoId: gdt,
    anio: y,
    mes: m,
  });
  const snap = await firestore
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("anio", "==", y)
    .where("mes", "==", m)
    .limit(1)
    .get();
  if (snap.empty) {
    return {
      ok: true,
      cerrado: false,
      existe: false,
      personas_vigentes,
      grupo_trabajo_id: gdt,
      anio: y,
      mes: m,
    };
  }
  const estadoId = snap.docs[0].data()?.estado_periodo_liquidacion_id || null;
  return {
    ok: true,
    cerrado: estadoId === CFG_EPL_LIQUIDADO_CERRADO,
    existe: true,
    estado_periodo_liquidacion_id: estadoId,
    personas_vigentes,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} firestore
 * @param {{ items: Array<{ grupo_trabajo_id: string, anio: number, mes: number }> }} params
 */
async function consultarEstadosPeriodoLiquidacionGrupoBatch(firestore, { items }) {
  const list = Array.isArray(items) ? items : [];
  const resultados = [];
  for (const it of list) {
    const row = await consultarPeriodoLiquidacionGrupoMes(firestore, it);
    resultados.push(row);
  }
  return { ok: true, items: resultados };
}

async function reabrirPeriodoLiquidacionCore(
  firestore,
  { grupoTrabajoId, anio, mes, actorPersonaId, motivo },
) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", actualizados: 0 };
  }
  const motivoTxt = String(motivo || "").trim();
  if (motivoTxt.length < 3) {
    return { ok: false, codigo: "MOTIVO_REQUERIDO", actualizados: 0 };
  }

  const snap = await firestore
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("anio", "==", y)
    .where("mes", "==", m)
    .get();

  if (snap.empty) {
    return { ok: true, actualizados: 0, grupo_trabajo_id: gdt, anio: y, mes: m };
  }

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  const actor = String(actorPersonaId || "").trim() || null;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
      periodo_reabierto_en: now,
      periodo_reabierto_por_persona_id: actor,
      periodo_reapertura_motivo: motivoTxt,
      periodo_cerrado_en: FieldValue.delete(),
      periodo_cerrado_por_persona_id: FieldValue.delete(),
      periodo_cierre_motivo: FieldValue.delete(),
    });
  }
  await batch.commit();

  return {
    ok: true,
    actualizados: snap.size,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
  };
}

module.exports = {
  consultarEstadoPeriodoLiquidacion,
  consultarPeriodoLiquidacionGrupoMes,
  consultarEstadosPeriodoLiquidacionGrupoBatch,
  assertPeriodoNoCerrado,
  assertNuevaSolicitudNoEnPeriodoCerrado,
  esEstadoSolicitudEnTramite,
  CODIGO_PERIODO_CERRADO,
  MSG_PERIODO_CERRADO,
  cerrarPeriodoLiquidacionCore,
  reabrirPeriodoLiquidacionCore,
  COL_VIS,
};

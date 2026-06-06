"use strict";

/**
 * Callables para re-materialización masiva de la capa teórica.
 * Uso: RRHH invoca tras cambio de calendario institucional o edición de régimen.
 */

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db } = require("../shared/context");
const runtimeFlags = require("../shared/runtimeFlags.json");
const { assertRrhh } = require("../shared/helpers");
const { invalidateCalendarioInstitucionalCache } = require("../shared/calendarService");
const { materializarGrupoMes } = require("./rdaTurnoTeoricoWorker");
const { materializarRango } = require("./materializarRango");
const { logger } = require("firebase-functions/v2");

const COL_HLG = "historial_laboral_grupos";
const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

function err(code, msg) {
  throw new HttpsError(code, msg);
}

function mesesVentanaDesdeHoy() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const mesSig = mesActual === 12 ? 1 : mesActual + 1;
  const anioSig = mesActual === 12 ? anio + 1 : anio;
  return { anio, mesActual, anioSig, mesSig };
}

/**
 * @param {string} grupoId
 * @param {string} fechaYmd
 */
async function listarPersonasVigentesGrupoEnFecha(grupoId, fechaYmd) {
  const hlgSnap = await db.collection(COL_HLG)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("activo", "==", true)
    .get();
  const personas = new Set();
  for (const doc of hlgSnap.docs) {
    const d = doc.data() || {};
    const pid = String(d.persona_id || "").trim();
    if (!/^per_/i.test(pid)) continue;
    const fi = String(d.fecha_inicio || "").slice(0, 10);
    const ff = d.fecha_fin ? String(d.fecha_fin).slice(0, 10) : "9999-12-31";
    if (fi && fi > fechaYmd) continue;
    if (ff < fechaYmd) continue;
    personas.add(pid);
  }
  return [...personas];
}

/**
 * Feriado/asueto: un día × agentes del grupo (materializarRango acotado).
 */
async function rematerializarCalendarioFechaYmd(fechaYmd, grupoIds) {
  const fallos = [];
  let agentesOk = 0;

  for (const gid of grupoIds) {
    const personas = await listarPersonasVigentesGrupoEnFecha(gid, fechaYmd);
    for (const personaId of personas) {
      try {
        const r = await materializarRango(db, {
          personaId,
          grupoId: gid,
          fechaDesdeYmd: fechaYmd,
          fechaHastaYmd: fechaYmd,
          motivo: "feriado_institucional",
        });
        if (r.ok) agentesOk += 1;
        else {
          fallos.push({
            persona_id: personaId,
            grupo_id: gid,
            fecha: fechaYmd,
            error: r.mensaje || r.codigo || "materializar_fallo",
          });
        }
      } catch (e) {
        fallos.push({
          persona_id: personaId,
          grupo_id: gid,
          fecha: fechaYmd,
          error: String(e).slice(0, 200),
        });
      }
    }
  }

  return {
    ok: fallos.length === 0,
    modo: "fecha_unica",
    fecha_ymd: fechaYmd,
    agentes_procesados: agentesOk,
    fallos,
  };
}

/**
 * Re-materializa grupos en mes actual + siguiente (mes completo).
 */
async function rematerializarCalendarioVentanaMeses(grupoIds) {
  const { anio, mesActual, anioSig, mesSig } = mesesVentanaDesdeHoy();
  const fallos = [];
  let ok = 0;

  for (const gid of grupoIds) {
    for (const [a, m] of [[anio, mesActual], [anioSig, mesSig]]) {
      try {
        const r = await materializarGrupoMes({
          grupoId: gid,
          anio: a,
          mes: m,
          materializacionMotivo: "rematerializar_calendario",
        });
        if (r.ok) ok += r.procesados || 0;
        else if (Array.isArray(r.fallos)) {
          for (const f of r.fallos) {
            fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, ...f });
          }
        }
      } catch (e) {
        logger.error("remat_calendario_error", { grupoId: gid, anio: a, mes: m, error: String(e) });
        fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, error: String(e).slice(0, 200) });
      }
    }
  }

  return {
    ok: fallos.length === 0,
    modo: "ventana_m_m_plus_1",
    periodos_procesados: ok,
    fallos,
  };
}

/**
 * Re-materializa tras cambio de calendario institucional.
 * `fecha_ymd` opcional: solo ese día vía materializarRango (O-P1-2 feriado puntual).
 */
const rematerializarPostCalendario = onCall({ invoker: "public", timeoutSeconds: 540 }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  invalidateCalendarioInstitucionalCache();

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const fechaYmd = typeof d.fecha_ymd === "string" ? d.fecha_ymd.trim() : "";
  const grupoIdsParam = Array.isArray(d.grupo_ids)
    ? d.grupo_ids.map((g) => String(g || "").trim()).filter((g) => /^gdt_/i.test(g))
    : [];

  const grupoIds = grupoIdsParam.length > 0 ? grupoIdsParam : await obtenerGruposActivos();
  if (grupoIds.length === 0) return { ok: true, grupos: 0, fallos: [] };

  let result;
  if (fechaYmd && RX_YMD.test(fechaYmd)) {
    result = await rematerializarCalendarioFechaYmd(fechaYmd, grupoIds);
  } else if (fechaYmd) {
    err("invalid-argument", "fecha_ymd inválida (YYYY-MM-DD).");
  } else {
    result = await rematerializarCalendarioVentanaMeses(grupoIds);
  }

  logger.info("rematerializarPostCalendario OK", {
    modo: result.modo,
    grupos: grupoIds.length,
    fallos: result.fallos?.length ?? 0,
  });

  return { ok: result.ok, grupos: grupoIds.length, ...result };
});

/**
 * Re-materializa todos los agentes de un régimen específico para mes actual y siguiente.
 */
const rematerializarPostRegimen = onCall({ invoker: "public", timeoutSeconds: 540 }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const regimenId = request.data && request.data.regimen_id;
  if (!regimenId || typeof regimenId !== "string") {
    err("invalid-argument", "regimen_id requerido.");
  }

  const hlgSnap = await db.collection(COL_HLG)
    .where("regimen_horario_id", "==", regimenId.trim())
    .where("activo", "==", true)
    .get();

  if (hlgSnap.empty) return { ok: true, grupos: 0, agentes: 0, fallos: [] };

  const grupoIds = [...new Set(hlgSnap.docs.map((doc) => doc.data().grupo_de_trabajo_id).filter(Boolean))];
  const { anio, mesActual, anioSig, mesSig } = mesesVentanaDesdeHoy();

  const fallos = [];
  let ok = 0;
  for (const gid of grupoIds) {
    for (const [a, m] of [[anio, mesActual], [anioSig, mesSig]]) {
      try {
        const r = await materializarGrupoMes({
          grupoId: gid,
          anio: a,
          mes: m,
          materializacionMotivo: "rematerializar_regimen",
        });
        if (r.ok) ok += r.procesados || 0;
        else if (Array.isArray(r.fallos)) {
          for (const f of r.fallos) fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, ...f });
        }
      } catch (e) {
        logger.error("remat_regimen_error", { grupoId: gid, regimenId, anio: a, mes: m, error: String(e) });
        fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, error: String(e).slice(0, 200) });
      }
    }
  }

  logger.info("rematerializarPostRegimen OK", { regimenId, grupos: grupoIds.length, ok, fallos: fallos.length });
  return { ok: fallos.length === 0, regimen_id: regimenId, grupos: grupoIds.length, periodos_procesados: ok, fallos };
});

async function obtenerGruposActivos() {
  const snap = await db.collection("grupos_de_trabajo")
    .where("activo", "==", true)
    .get();
  return snap.docs.map((doc) => doc.id);
}

module.exports = {
  rematerializarPostCalendario,
  rematerializarPostRegimen,
  rematerializarCalendarioFechaYmd,
  listarPersonasVigentesGrupoEnFecha,
};

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
const { logger } = require("firebase-functions/v2");

const COL_HLG = "historial_laboral_grupos";

function err(code, msg) {
  throw new HttpsError(code, msg);
}

/**
 * Re-materializa todos los grupos activos para mes actual y siguiente.
 * Diseñado para invocar después de un cambio en el calendario institucional.
 * Solo RRHH.
 */
const rematerializarPostCalendario = onCall({ invoker: "public", timeoutSeconds: 540 }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  invalidateCalendarioInstitucionalCache();

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const mesSig = mesActual === 12 ? 1 : mesActual + 1;
  const anioSig = mesActual === 12 ? anio + 1 : anio;

  const grupoIds = await obtenerGruposActivos();
  if (grupoIds.length === 0) return { ok: true, grupos: 0, fallos: [] };

  const fallos = [];
  let ok = 0;
  for (const gid of grupoIds) {
    for (const [a, m] of [[anio, mesActual], [anioSig, mesSig]]) {
      try {
        await materializarGrupoMes({ grupoId: gid, anio: a, mes: m });
        ok++;
      } catch (e) {
        logger.error("remat_calendario_error", { grupoId: gid, anio: a, mes: m, error: String(e) });
        fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, error: String(e).slice(0, 200) });
      }
    }
  }

  logger.info("rematerializarPostCalendario OK", { grupos: grupoIds.length, ok, fallos: fallos.length });
  return { ok: true, grupos: grupoIds.length, periodos_procesados: ok, fallos };
});

/**
 * Re-materializa todos los agentes de un régimen específico para mes actual y siguiente.
 * Diseñado para invocar después de editar un régimen horario.
 * Solo RRHH.
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

  const grupoIds = [...new Set(hlgSnap.docs.map((d) => d.data().grupo_de_trabajo_id).filter(Boolean))];

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const mesSig = mesActual === 12 ? 1 : mesActual + 1;
  const anioSig = mesActual === 12 ? anio + 1 : anio;

  const fallos = [];
  let ok = 0;
  for (const gid of grupoIds) {
    for (const [a, m] of [[anio, mesActual], [anioSig, mesSig]]) {
      try {
        await materializarGrupoMes({ grupoId: gid, anio: a, mes: m });
        ok++;
      } catch (e) {
        logger.error("remat_regimen_error", { grupoId: gid, regimenId, anio: a, mes: m, error: String(e) });
        fallos.push({ grupoId: gid, periodo: `${a}-${String(m).padStart(2, "0")}`, error: String(e).slice(0, 200) });
      }
    }
  }

  logger.info("rematerializarPostRegimen OK", { regimenId, grupos: grupoIds.length, ok, fallos: fallos.length });
  return { ok: true, regimen_id: regimenId, grupos: grupoIds.length, periodos_procesados: ok, fallos };
});

async function obtenerGruposActivos() {
  const snap = await db.collection("grupos_de_trabajo")
    .where("activo", "==", true)
    .get();
  return snap.docs.map((d) => d.id);
}

module.exports = {
  rematerializarPostCalendario,
  rematerializarPostRegimen,
};

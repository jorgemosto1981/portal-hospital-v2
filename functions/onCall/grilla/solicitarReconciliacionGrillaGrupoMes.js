"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId, assertPlanAuth } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");
const {
  marcarGrillaSyncGrupoMesPendiente,
  leerGrillaSyncGrupoMes,
} = require("../../modules/shared/grillaSyncGrupoMesCore");
const { listarVistaGrillaMesPorGrupo } = require("../../modules/shared/grillaMesAgenteCore");

const solicitarReconciliacionGrillaGrupoMesCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const grupoTrabajoId =
    typeof d.grupo_trabajo_id === "string" ? d.grupo_trabajo_id.trim() : "";
  const anio = Number(d.anio);
  const mes = Number(d.mes);

  if (!/^gdt_/i.test(grupoTrabajoId)) {
    throw new HttpsError("invalid-argument", "grupo_trabajo_id inválido.");
  }
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
    throw new HttpsError("invalid-argument", "anio y mes son obligatorios.");
  }

  assertAgenteConPersonaId(request);
  const token = request.auth.token || {};
  const esRrhh = tokenHasRrhhLaborAccess(token);

  if (!esRrhh && runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    await assertPlanAuth(request, grupoTrabajoId, "leer");
  }

  const forzarSincrono = d.forzar_sincrono === true && esRrhh;

  if (forzarSincrono) {
    const result = await listarVistaGrillaMesPorGrupo(db, {
      grupoTrabajoId,
      anio,
      mes,
      forzarMaterializacionGrupo: true,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "No se pudo materializar el sector.");
    }
    const sync = await leerGrillaSyncGrupoMes(db, { grupoTrabajoId, anio, mes });
    return { ok: true, modo: "sincrono", listado: result, grilla_sync: sync };
  }

  const marcado = await marcarGrillaSyncGrupoMesPendiente(db, {
    grupoTrabajoId,
    anio,
    mes,
    origen: esRrhh ? "rrhh_manual" : "jefe_manual",
    metadata: {
      solicitado_por_rrhh: esRrhh,
    },
  });
  const sync = await leerGrillaSyncGrupoMes(db, { grupoTrabajoId, anio, mes });
  return { ok: true, modo: "async", marcado, grilla_sync: sync };
});

module.exports = { solicitarReconciliacionGrillaGrupoMes: solicitarReconciliacionGrillaGrupoMesCallable };

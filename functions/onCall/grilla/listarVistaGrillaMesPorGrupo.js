"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { listarVistaGrillaMesPorGrupo } = require("../../modules/shared/grillaMesAgenteCore");
const { evaluarPoliticaGsoAnioMes } = require("../../modules/asistencia/grillaGsoSoloLectura");

const listarVistaGrillaMesPorGrupoCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil para consultar grilla.");
  }

  assertAgenteConPersonaId(request);

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

  try {
    const result = await listarVistaGrillaMesPorGrupo(db, {
      grupoTrabajoId,
      anio,
      mes,
    });

    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Consulta inválida.");
    }

    const esRrhhLabor = tokenHasRrhhLaborAccess(token);
    const politica = evaluarPoliticaGsoAnioMes({ anio, mes, esRrhhLabor });

    return {
      ...result,
      gso_politica_mes: politica,
      gso_solo_lectura: !esRrhhLabor && politica.solo_lectura,
      gso_solo_lectura_motivo: politica.motivo || null,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("listarVistaGrillaMesPorGrupo", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al listar grilla del grupo.",
    );
  }
});

module.exports = { listarVistaGrillaMesPorGrupo: listarVistaGrillaMesPorGrupoCallable };

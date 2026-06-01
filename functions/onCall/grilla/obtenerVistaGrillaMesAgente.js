"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { obtenerVistaGrillaMesAgente } = require("../../modules/shared/grillaMesAgenteCore");
const { evaluarPoliticaGsoAnioMes } = require("../../modules/asistencia/grillaGsoSoloLectura");
const { CFG_EPL_LIQUIDADO_CERRADO } = require("../../modules/shared/cfgAsistenciaTurnosIds");

const obtenerVistaGrillaMesAgenteCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil para consultar grilla.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const revisorPersonaId = assertAgenteConPersonaId(request);
  const titular =
    typeof d.persona_id === "string" && /^per_/i.test(d.persona_id.trim())
      ? d.persona_id.trim()
      : revisorPersonaId;

  if (titular !== revisorPersonaId && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo podés consultar tu propia grilla mensual.");
  }

  const anio = Number(d.anio);
  const mes = Number(d.mes);
  const grupoTrabajoId = typeof d.grupo_trabajo_id === "string" ? d.grupo_trabajo_id.trim()
    : (typeof d.grupo_id === "string" ? d.grupo_id.trim() : "");
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
    throw new HttpsError("invalid-argument", "anio y mes son obligatorios.");
  }
  if (!/^gdt_/i.test(grupoTrabajoId)) {
    throw new HttpsError("invalid-argument", "grupo_trabajo_id (gdt_*) es obligatorio.");
  }

  const result = await obtenerVistaGrillaMesAgente(db, {
    personaId: titular,
    grupoTrabajoId,
    anio,
    mes,
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "Consulta inválida.");
  }

  const esRrhhLabor = tokenHasRrhhLaborAccess(token);
  const politica = evaluarPoliticaGsoAnioMes({ anio, mes, esRrhhLabor });
  const periodoCerrado = result.estado_periodo_liquidacion_id === CFG_EPL_LIQUIDADO_CERRADO;

  return {
    ...result,
    gso_politica_mes: politica,
    gso_solo_lectura: !esRrhhLabor && (politica.solo_lectura || periodoCerrado),
    gso_solo_lectura_motivo: periodoCerrado
      ? "periodo_cerrado"
      : (politica.motivo || null),
    metadata: result.metadata || null,
  };
});

module.exports = { obtenerVistaGrillaMesAgente: obtenerVistaGrillaMesAgenteCallable };

"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const {
  actualizarAvisoMedicoIncompleto,
  buscarAvisoIncompletaVigente,
} = require("../../modules/shared/avisoMedicoCajaNegraCore");

const actualizarAvisoMedicoIncompletoCallable = onCall(async (request) => {
  const titularPersonaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  const adjuntos = Array.isArray(d.adjuntos) ? d.adjuntos : [];
  const fechaInicioReposoEstimada =
    typeof d.fecha_inicio_reposo_estimada === "string" ? d.fecha_inicio_reposo_estimada.trim() : undefined;

  const fechaFinReposoEstimada =
    typeof d.fecha_fin_reposo_estimada === "string" ? d.fecha_fin_reposo_estimada.trim() : undefined;
  const declaracionClinica =
    d.declaracion_clinica && typeof d.declaracion_clinica === "object" ? d.declaracion_clinica : undefined;
  const declaracionContacto =
    d.declaracion_contacto && typeof d.declaracion_contacto === "object" ? d.declaracion_contacto : undefined;

  const result = await actualizarAvisoMedicoIncompleto(db, {
    solicitudId,
    titularPersonaId,
    adjuntos,
    fechaInicioReposoEstimada,
    fechaFinReposoEstimada,
    declaracionClinica,
    declaracionContacto,
  });

  if (!result.ok) {
    const code =
      result.codigo === "LICENCIA_INCOMPLETA_VENCIDA"
        ? "failed-precondition"
        : result.codigo === "NO_TITULAR" || result.codigo === "ESTADO_INVALIDO"
          ? "permission-denied"
          : "invalid-argument";
    throw new HttpsError(code, result.mensaje || "No se pudo completar el aviso.");
  }

  return result;
});

const buscarAvisoIncompletaVigenteCallable = onCall(async (request) => {
  const titularPersonaId = assertAgenteConPersonaId(request);
  return buscarAvisoIncompletaVigente(db, titularPersonaId);
});

module.exports = {
  actualizarAvisoMedicoIncompleto: actualizarAvisoMedicoIncompletoCallable,
  buscarAvisoIncompletaVigente: buscarAvisoIncompletaVigenteCallable,
};

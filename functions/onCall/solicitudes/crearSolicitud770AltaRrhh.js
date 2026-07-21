"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { parseYmd } = require("../../modules/shared/laoPreviewDateUtils");
const {
  materializarSol770AltaRrhh,
} = require("../../modules/shared/solicitudArt770DerivacionCore");
const {
  resolverGrupoTrabajoIdAnclaParaSolicitud,
} = require("../../modules/shared/solicitudGrupoTrabajoAncla");

const crearSolicitud770AltaRrhhCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (!tokenHasRrhhLaborAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Se requiere rol CFG_RRHH.");
  }

  const actorPersonaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};

  const titularPersonaId =
    typeof d.titular_persona_id === "string" ? d.titular_persona_id.trim() : "";
  if (!/^per_/i.test(titularPersonaId)) {
    throw new HttpsError("invalid-argument", "titular_persona_id inválido.");
  }

  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  const fechaHastaRaw =
    typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim().slice(0, 10) : "";
  const fechaHasta = parseYmd(fechaHastaRaw) ? fechaHastaRaw : fechaDesde;
  if (fechaHasta < fechaDesde) {
    throw new HttpsError("invalid-argument", "fecha_hasta no puede ser anterior a fecha_desde.");
  }

  const diasRaw = Number(d.dias_solicitados);
  const diasSolicitados =
    Number.isFinite(diasRaw) && diasRaw > 0 ? Math.floor(diasRaw) : undefined;

  const observacionAlta =
    typeof d.observacion_alta === "string" ? d.observacion_alta.trim() : "";
  if (!observacionAlta) {
    throw new HttpsError("invalid-argument", "El campo Detalles es obligatorio.");
  }

  const gdtPayload =
    typeof d.grupo_trabajo_id_ancla === "string" ? d.grupo_trabajo_id_ancla.trim() : "";

  const ancla = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
    persona_id: titularPersonaId,
    fecha_desde: fechaDesde,
    grupo_trabajo_id_ancla: gdtPayload || null,
  });
  if (!ancla.ok) {
    throw new HttpsError("failed-precondition", ancla.mensaje || "Sin grupo de trabajo ancla.");
  }

  const result = await materializarSol770AltaRrhh(db, {
    titularPersonaId,
    fechaDesde,
    fechaHasta,
    diasSolicitados,
    grupoTrabajoIdAncla: ancla.grupo_trabajo_id_ancla,
    actorPersonaId,
    observacionAlta,
  });

  if (!result.ok) {
    if (result.codigo === "ART_77_0_NO_CONFIGURADO") {
      throw new HttpsError("not-found", result.mensaje);
    }
    if (result.codigo === "CIRCUITO_ROL") {
      throw new HttpsError("permission-denied", result.mensaje);
    }
    throw new HttpsError("failed-precondition", result.mensaje || "No se pudo crear el Art. 77-0.");
  }

  return {
    ok: true,
    solicitud_77_0_id: result.solicitud_77_0_id,
    dias_acumulados: result.dias_acumulados,
    alerta_umbral_emitida: result.alerta_umbral_emitida === true,
  };
});

module.exports = {
  crearSolicitud770AltaRrhh: crearSolicitud770AltaRrhhCallable,
};

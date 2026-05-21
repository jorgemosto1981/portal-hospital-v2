"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { resolvePersonaIdSolicitudFlujoAgente } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewMotor");
const {
  mapHlcRow,
  filterHlcVigentesEnFecha,
  computeAntiguedadMeses,
} = require("../../modules/shared/solicitudElegibilidadLaboral");
const { loadHlcArray } = require("../../modules/shared/solicitudPatronBAltaMotor");
const { listarGruposTrabajoVigentesEnFecha } = require("../../modules/shared/solicitudGrupoTrabajoAncla");

const resolverContextoLaboralSolicitud = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = resolvePersonaIdSolicitudFlujoAgente(request, d);
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  if (!personaSnap.exists) {
    throw new HttpsError("not-found", "La persona no existe.");
  }

  const hlcArray = await loadHlcArray(db, personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde).map((h) => {
    const row = mapHlcRow(h, h.id);
    return {
      hlc_id: row.id,
      escalafon_id: row.escalafon_id || null,
      agrupamiento_id: row.agrupamiento_id || null,
      cargo_funcional_id: row.cargo_funcional_id || null,
      tipo_vinculo_id: row.tipo_vinculo_id || null,
      grupo_de_trabajo_id: row.grupo_de_trabajo_id || null,
      rol_id: row.rol_id || null,
    };
  });

  const persona = personaSnap.data() || {};
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;
  const antiguedad_meses = computeAntiguedadMeses(hlcArray, fechaDesde, externos);
  const grupos_trabajo_vigentes = await listarGruposTrabajoVigentesEnFecha(db, personaId, fechaDesde);

  return {
    persona_id: personaId,
    fecha_desde: fechaDesde,
    hlc_vigentes: hlcVigentes,
    grupos_trabajo_vigentes,
    grupo_trabajo_id_ancla_sugerido:
      grupos_trabajo_vigentes.length === 1 ? grupos_trabajo_vigentes[0].grupo_de_trabajo_id : null,
    requiere_seleccion_grupo: grupos_trabajo_vigentes.length > 1,
    antiguedad_meses,
    elegibilidad_base_ok: hlcVigentes.length > 0,
  };
});

module.exports = { resolverContextoLaboralSolicitud };

"use strict";

const { ESTADO_ESPERANDO_JUNTA } = require("./registrarDictamenJuntaMedicaCore");
const { SCHEMA_MED_AVISO } = require("./avisoMedicoCajaNegraCore");
const { loadArticuloDisplay, loadPersonaBandeja } = require("./solicitudBandejaJefeCore");
const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const SCAN_LIMIT = 400;

const FILTRO_PENDIENTES = "pendientes";

/**
 * @param {Record<string, unknown>} sol
 */
function resumenClasificacionAuditor(sol) {
  const clasif =
    sol.auditor_medico_clasificacion && typeof sol.auditor_medico_clasificacion === "object"
      ? sol.auditor_medico_clasificacion
      : null;
  if (!clasif) return null;
  const obs = clasif.observacion_auditor != null ? String(clasif.observacion_auditor).trim() : "";
  const auditorId = String(clasif.auditor_persona_id || "").trim();
  return {
    requiere_junta_medica: clasif.requiere_junta_medica === true,
    observacion_auditor: obs || null,
    auditor_persona_id: auditorId || null,
    clasificado_en: clasif.clasificado_en || null,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} opts
 */
async function listarSolicitudesBandejaJuntaMedica(db, opts = {}) {
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaListPageOpts(opts, {
    filtroDefault: FILTRO_PENDIENTES,
  });

  let titularIdsDni = null;
  if (dni) {
    titularIdsDni = await resolverPersonaIdsPorDni(db, dni);
    if (titularIdsDni && titularIdsDni.size === 0) {
      return {
        solicitudes: [],
        page_info: {
          page_size: pageSize,
          has_more: false,
          next_cursor: null,
          total_filtrado: 0,
        },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "==", ESTADO_ESPERANDO_JUNTA)
    .limit(SCAN_LIMIT)
    .get();

  const out = [];
  const personaCache = new Map();
  const articuloCache = new Map();

  for (const doc of snap.docs) {
    const sol = { id: doc.id, ...(doc.data() || {}) };
    if (String(sol.schema_version || "").trim() !== SCHEMA_MED_AVISO) continue;

    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;
    if (titularIdsDni && !titularIdsDni.has(titularId)) continue;

    const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
    if (usuario) {
      const hayUsuario =
        String(personaRow.label || "")
          .toLowerCase()
          .includes(usuario) ||
        String(personaRow.dni || "").includes(usuario.replace(/\D/g, ""));
      if (!hayUsuario) continue;
    }

    const clasifResumen = resumenClasificacionAuditor(sol);
    const yaDictaminada =
      sol.junta_medica_dictamen && typeof sol.junta_medica_dictamen === "object";

    if (filtroVista === FILTRO_PENDIENTES && yaDictaminada) continue;

    const artId = String(sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);
    const versionId = String(
      sol.version_aplicada_id || sol.version_aplicada || sol.version_id_aplicada || "",
    ).trim();

    const item = {
      solicitud_id: sol.id,
      articulo_id: artId,
      version_aplicada_id: versionId || null,
      articulo_label: artDisplay.articulo_label,
      codigo_grilla: artDisplay.codigo_grilla,
      articulo_nombre: artDisplay.nombre,
      titular_persona_id: titularId,
      titular_label: personaRow.label,
      titular_dni: personaRow.dni || null,
      fecha_desde: fechaRef,
      fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
      dias_solicitados: Number(sol.dias_solicitados) || 1,
      estado_solicitud_id: sol.estado_solicitud_id,
      creado_en: sol.creado_en || null,
      grupo_trabajo_id_ancla: String(sol.grupo_trabajo_id_ancla || "").trim() || null,
      auditor_medico_clasificacion: clasifResumen,
      auditor_observacion: clasifResumen?.observacion_auditor || null,
      auditor_persona_id: clasifResumen?.auditor_persona_id || null,
      puede_dictaminar: !yaDictaminada && clasifResumen?.requiere_junta_medica === true,
      etiqueta_estado: yaDictaminada
        ? "Dictamen registrado (estado pendiente de sincronizar)"
        : "Esperando dictamen de junta médica",
    };

    out.push(item);
  }

  out.sort((a, b) => String(a.fecha_desde).localeCompare(String(b.fecha_desde)));
  const page = paginarBandejaOrdenada(out, { cursor, pageSize });

  return {
    solicitudes: page.solicitudes,
    page_info: {
      page_size: pageSize,
      has_more: page.has_more,
      next_cursor: page.next_cursor,
      total_filtrado: page.total_filtrado,
      scan_limit: SCAN_LIMIT,
    },
    filtros: {
      filtro_vista: filtroVista,
      dni: dni || null,
      usuario: usuario || null,
    },
  };
}

module.exports = {
  listarSolicitudesBandejaJuntaMedica,
  resumenClasificacionAuditor,
  FILTRO_PENDIENTES,
};

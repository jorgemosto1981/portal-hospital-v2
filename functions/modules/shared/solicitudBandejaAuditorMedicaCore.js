"use strict";

const { ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA } = require("./solicitudesArticuloEstados");
const { SCHEMA_MED_AVISO } = require("./avisoMedicoCajaNegraCore");
const { loadArticuloDisplay, loadPersonaBandeja } = require("./solicitudBandejaJefeCore");
const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const SCAN_LIMIT = 400;

const FILTRO_COMPLETAS = "completas";
const FILTRO_PROVISORIAS = "provisorias";
const FILTRO_TODAS = "todas";

/**
 * @param {Record<string, unknown>} sol
 */
function esIncompletaMedica(sol) {
  const ing =
    sol.ingreso_medico && typeof sol.ingreso_medico === "object" ? sol.ingreso_medico : {};
  return ing.es_licencia_incompleta === true;
}

/**
 * @param {Record<string, unknown>} sol
 * @param {boolean} incompleta
 */
function etiquetaBandejaAuditor(sol, incompleta) {
  if (incompleta) {
    const venc = String(sol.vencimiento_plazo_certificado || "").trim();
    return venc ? `Provisoria — plazo certificado ${venc.slice(0, 10)}` : "Provisoria (sin certificado)";
  }
  return "Pendiente clasificación médica";
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} filtroVista
 */
function itemPasaFiltroIncompleta(item, filtroVista) {
  const v = String(filtroVista || FILTRO_COMPLETAS);
  if (v === FILTRO_TODAS) return true;
  if (v === FILTRO_PROVISORIAS) return item.es_licencia_incompleta === true;
  return item.es_licencia_incompleta !== true;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} opts
 */
async function listarSolicitudesBandejaAuditorMedica(db, opts = {}) {
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaListPageOpts(opts, {
    filtroDefault: FILTRO_COMPLETAS,
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
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA)
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

    const incompleta = esIncompletaMedica(sol);
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
      es_licencia_incompleta: incompleta,
      vencimiento_plazo_certificado: sol.vencimiento_plazo_certificado || null,
      puede_clasificar: !incompleta,
      etiqueta_estado: etiquetaBandejaAuditor(sol, incompleta),
    };

    if (!itemPasaFiltroIncompleta(item, filtroVista)) continue;
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
  listarSolicitudesBandejaAuditorMedica,
  itemPasaFiltroIncompleta,
  esIncompletaMedica,
  FILTRO_COMPLETAS,
  FILTRO_PROVISORIAS,
  FILTRO_TODAS,
};

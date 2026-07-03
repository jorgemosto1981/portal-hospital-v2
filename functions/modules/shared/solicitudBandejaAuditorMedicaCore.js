"use strict";

const { ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA } = require("./solicitudesArticuloEstados");
const { SCHEMA_MED_AVISO } = require("./avisoMedicoCajaNegraCore");
const { resolverRangoYmdEfectivoAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const { loadArticuloDisplay, loadPersonaBandeja } = require("./solicitudBandejaJefeCore");
const { enriquecerItemBandejaAuditorLarga } = require("./solicitudBandejaAuditorMedicaLargaMeta");
const {
  mapearAdjuntosBandejaAuditor,
} = require("./solicitudBandejaAuditorCertificados");
const {
  mapearFichaIngresoAgenteBandejaAuditor,
} = require("./solicitudBandejaAuditorIngresoMedico");
const { parseBandejaListPageOpts, resolverPersonaIdsPorDni } = require("./solicitudBandejaListUtils");
const { escanearBandejaAuditorPaginada } = require("./solicitudBandejaAuditorPaginacionCore");

const { iterarYmdInclusive } = require("./mdcRdaDocumentIds");

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
 * @param {import("firebase-admin/firestore").QueryDocumentSnapshot} doc
 * @param {{
 *   filtroVista: string,
 *   usuario: string,
 *   personaCache: Map<string, unknown>,
 *   articuloCache: Map<string, unknown>,
 *   causalCache: Map<string, unknown>,
 *   versionLargaCache: Map<string, unknown>,
 * }} ctx
 */
async function mapDocBandejaAuditorMedica(db, doc, ctx) {
  const sol = { id: doc.id, ...(doc.data() || {}) };
  if (String(sol.schema_version || "").trim() !== SCHEMA_MED_AVISO) return null;

  const titularId = String(sol.titular_persona_id || "").trim();
  const rango = resolverRangoYmdEfectivoAvisoMedico(sol);
  if (!rango || !/^per_/i.test(titularId)) return null;

  const fechaRef = rango.fecha_desde;
  const fechaHastaRef = rango.fecha_hasta;

  const personaRow = await loadPersonaBandeja(db, titularId, ctx.personaCache);
  if (ctx.usuario) {
    const hayUsuario =
      String(personaRow.label || "")
        .toLowerCase()
        .includes(ctx.usuario) ||
      String(personaRow.dni || "").includes(ctx.usuario.replace(/\D/g, ""));
    if (!hayUsuario) return null;
  }

  const incompleta = esIncompletaMedica(sol);
  const artId = String(sol.articulo_id || "").trim();
  const artDisplay = await loadArticuloDisplay(db, artId, ctx.articuloCache);
  const versionId = String(
    sol.version_aplicada_id || sol.version_aplicada || sol.version_id_aplicada || "",
  ).trim();

  const largaMeta = await enriquecerItemBandejaAuditorLarga(
    db,
    sol,
    { articuloId: artId, versionId },
    { causalCache: ctx.causalCache, versionCache: ctx.versionLargaCache },
  );

  const certificado_adjuntos = mapearAdjuntosBandejaAuditor(sol);
  const ficha_ingreso_agente = mapearFichaIngresoAgenteBandejaAuditor(sol);
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
    fecha_hasta: fechaHastaRef,
    dias_solicitados:
      Number(sol.dias_solicitados) || Math.max(1, iterarYmdInclusive(fechaRef, fechaHastaRef).length),
    estado_solicitud_id: sol.estado_solicitud_id,
    creado_en: sol.creado_en || null,
    grupo_trabajo_id_ancla: String(sol.grupo_trabajo_id_ancla || "").trim() || null,
    es_licencia_incompleta: incompleta,
    vencimiento_plazo_certificado: sol.vencimiento_plazo_certificado || null,
    puede_clasificar: !incompleta,
    etiqueta_estado: etiquetaBandejaAuditor(sol, incompleta),
    certificado_adjuntos,
    tiene_certificado: certificado_adjuntos.length > 0,
    ficha_ingreso_agente,
    ...largaMeta,
  };

  if (!itemPasaFiltroIncompleta(item, ctx.filtroVista)) return null;
  return item;
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
          total_filtrado: null,
        },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const personaCache = new Map();
  const articuloCache = new Map();
  const causalCache = new Map();
  const versionLargaCache = new Map();

  const ctx = {
    filtroVista,
    usuario,
    personaCache,
    articuloCache,
    causalCache,
    versionLargaCache,
  };

  const page = await escanearBandejaAuditorPaginada(db, {
    estadoPendiente: ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
    titularIds: titularIdsDni,
    cursor,
    pageSize,
    mapDoc: (doc) => mapDocBandejaAuditorMedica(db, doc, ctx),
  });

  return {
    solicitudes: page.items,
    page_info: {
      page_size: pageSize,
      has_more: page.has_more,
      next_cursor: page.next_cursor,
      total_filtrado: page.total_filtrado,
      firestore_batches: page.firestore_batches,
      order_field: page.order_field,
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
  mapearAdjuntosBandejaAuditor,
  mapearFichaIngresoAgenteBandejaAuditor,
  mapDocBandejaAuditorMedica,
  FILTRO_COMPLETAS,
  FILTRO_PROVISORIAS,
  FILTRO_TODAS,
};

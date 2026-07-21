"use strict";

/**
 * Catálogo de artículos por rol de actor (`circuito_ingreso_ids`).
 * Aislado de listarArticulosIngresoCore (Etapa 1 / solo B-C).
 */

const { parseYmd } = require("./laoPreviewDateUtils");
const { resolvePatronSaldo } = require("./resolvePatronSaldo");
const { getAllDocsChunked } = require("./firestoreGetAllChunked");
const {
  rolesHlcFromAuthToken,
  filterHlcVigentesEnFecha,
  mapHlcRow,
  computeAntiguedadMeses,
  evaluarFiltrosElegibilidadHlc,
  mensajeParaCodigo,
  CODIGO_ELEG_SIN_HLC,
} = require("./solicitudElegibilidadLaboral");
const { loadHlcArray } = require("./patronBAltaMotorV2");

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

const ROLES_CIRCUITO_CANONICOS = Object.freeze([
  "CFG_USUARIO",
  "CFG_RRHH",
  "CFG_MEDICO",
  "CFG_VISUALIZADOR",
]);

const ROLES_TITULAR_AJENO = Object.freeze(["CFG_RRHH", "CFG_MEDICO", "CFG_VISUALIZADOR"]);

/**
 * @param {unknown} rolId
 * @returns {string}
 */
function normalizarRolCircuito(rolId) {
  const r = String(rolId || "").trim().toUpperCase();
  return ROLES_CIRCUITO_CANONICOS.includes(r) ? r : "";
}

/**
 * @param {unknown} token
 * @param {string} rolSolicitado
 */
function tokenIncluyeRolCircuito(token, rolSolicitado) {
  const rol = normalizarRolCircuito(rolSolicitado);
  if (!rol) return false;
  return rolesHlcFromAuthToken(token).includes(rol);
}

/**
 * @param {string} actorPersonaId
 * @param {string} titularPersonaId
 * @param {string} rolActor
 */
function puedeConsultarTitularAjeno(actorPersonaId, titularPersonaId, rolActor) {
  const actor = String(actorPersonaId || "").trim();
  const titular = String(titularPersonaId || "").trim();
  const rol = normalizarRolCircuito(rolActor);
  if (!/^per_/i.test(actor) || !/^per_/i.test(titular)) return false;
  if (actor === titular) return true;
  return ROLES_TITULAR_AJENO.includes(rol);
}

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @param {string} rolId
 */
function versionIncluyeRolEnCircuito(versionData, rolId) {
  const rol = normalizarRolCircuito(rolId);
  if (!rol) return false;
  const bloque = versionData?.bloque_workflow_sla_cobertura;
  const raw = bloque && typeof bloque === "object" ? bloque.circuito_ingreso_ids : [];
  const list = Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
  return list.includes(rol);
}

/**
 * @param {Record<string, unknown> | null | undefined} core
 */
function esArticuloOperativo(core) {
  if (!core || typeof core !== "object") return false;
  if (core.activo === false) return false;
  return true;
}

/**
 * @param {Record<string, unknown>} versionData
 * @param {Record<string, unknown>} versionDataOther
 */
function versionPublicadaEsMasReciente(versionData, versionDataOther) {
  const a = String(versionData.vigente_desde || "").slice(0, 10);
  const b = String(versionDataOther.vigente_desde || "").slice(0, 10);
  if (!a) return false;
  if (!b) return true;
  return a > b;
}

/**
 * @param {Record<string, unknown>} versionData
 * @returns {string | null}
 */
function patronDesdeVersion(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  return resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);
}

/**
 * Descubre artículos con versión publicada (cualquier patrón).
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function discoverArticulosVersionPublicada(db) {
  const verSnap = await db
    .collectionGroup("versiones")
    .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
    .get();

  /** @type {Map<string, { versionData: Record<string, unknown>, versionId: string }>} */
  const porArticulo = new Map();
  for (const verDoc of verSnap.docs) {
    const articuloId = verDoc.ref.parent?.parent?.id;
    if (!articuloId) continue;
    const versionData = verDoc.data() || {};
    const prev = porArticulo.get(articuloId);
    if (prev && !versionPublicadaEsMasReciente(versionData, prev.versionData)) continue;
    porArticulo.set(articuloId, { versionData, versionId: verDoc.id });
  }

  const ids = [...porArticulo.keys()];
  if (!ids.length) return [];

  const refs = ids.map((id) => db.collection("cfg_articulos").doc(id));
  const artSnaps = await getAllDocsChunked(db, refs);
  /** @type {Array<{ articuloId: string, core: Record<string, unknown>, versionData: Record<string, unknown>, versionId: string }>} */
  const out = [];
  for (const artSnap of artSnaps) {
    if (!artSnap.exists) continue;
    const core = artSnap.data() || {};
    if (!esArticuloOperativo(core)) continue;
    const meta = porArticulo.get(artSnap.id);
    if (!meta) continue;
    out.push({
      articuloId: artSnap.id,
      core,
      versionData: meta.versionData,
      versionId: meta.versionId,
    });
  }
  return out;
}

/**
 * Elegibilidad laboral del titular (filtros), sin exigir que el titular tenga el rol del circuito.
 * @param {{
 *   versionData: Record<string, unknown>,
 *   hlcVigentes: Array<Record<string, unknown>>,
 *   personaId: string,
 *   fechaDesde: string,
 *   diasExternos?: number,
 * }} params
 */
function evaluarElegibilidadTitular(params) {
  const { versionData, hlcVigentes, personaId, fechaDesde, diasExternos = 0 } = params;
  const hlcArray = (hlcVigentes || []).map((h) => mapHlcRow(h, h.id));
  if (hlcArray.length === 0) {
    return {
      ok: false,
      codigos: [CODIGO_ELEG_SIN_HLC],
      mensajes: [mensajeParaCodigo(CODIGO_ELEG_SIN_HLC)],
    };
  }
  const filtros = versionData?.bloque_elegibilidad_filtros || {};
  const antiguedadMeses = computeAntiguedadMeses(hlcArray, fechaDesde, diasExternos);
  for (const hlc of hlcArray) {
    const cod = evaluarFiltrosElegibilidadHlc(filtros, hlc, personaId, antiguedadMeses);
    if (!cod) {
      return { ok: true, codigos: [], mensajes: [], hlc_id: hlc.id || null };
    }
  }
  const last = hlcArray[0];
  const codFail = evaluarFiltrosElegibilidadHlc(filtros, last, personaId, antiguedadMeses);
  const codigo = codFail || CODIGO_ELEG_SIN_HLC;
  return {
    ok: false,
    codigos: [codigo],
    mensajes: [mensajeParaCodigo(codigo)],
  };
}

/**
 * @param {{
 *   db: import("firebase-admin/firestore").Firestore,
 *   rolActor: string,
 *   actorPersonaId: string,
 *   titularPersonaId: string,
 *   fechaDesde: string,
 *   authToken: unknown,
 * }} params
 */
async function listarArticulosIngresoPorRol(params) {
  const { db, rolActor, actorPersonaId, titularPersonaId, fechaDesde, authToken } = params;

  const rol = normalizarRolCircuito(rolActor);
  if (!rol) {
    return { error: "invalid-argument", message: "rol_id inválido." };
  }
  if (!tokenIncluyeRolCircuito(authToken, rol)) {
    return { error: "permission-denied", message: `Se requiere el rol ${rol} en la sesión.` };
  }
  if (!parseYmd(fechaDesde)) {
    return { error: "invalid-argument", message: "fecha_desde debe ser YYYY-MM-DD." };
  }
  if (!puedeConsultarTitularAjeno(actorPersonaId, titularPersonaId, rol)) {
    return {
      error: "permission-denied",
      message: "No podés consultar artículos para otra persona con este rol.",
    };
  }

  const titularSnap = await db.collection("personas").doc(titularPersonaId).get();
  if (!titularSnap.exists) {
    return { error: "not-found", message: "La persona titular no existe." };
  }
  const persona = titularSnap.data() || {};
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

  const hlcArray = await loadHlcArray(db, titularPersonaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);

  const candidatos = await discoverArticulosVersionPublicada(db);
  /** @type {Array<object>} */
  const articulos = [];

  for (const cand of candidatos) {
    const { articuloId, core, versionData, versionId } = cand;
    if (!versionIncluyeRolEnCircuito(versionData, rol)) continue;

    const eleg = evaluarElegibilidadTitular({
      versionData,
      hlcVigentes,
      personaId: titularPersonaId,
      fechaDesde,
      diasExternos: externos,
    });

    articulos.push({
      articulo_id: articuloId,
      version_id: versionId,
      codigo_grilla: String(core.codigo || core.nombre_corto || "").trim() || "ART",
      nombre: String(core.nombre || core.codigo || "").trim(),
      patron_saldo: patronDesdeVersion(versionData),
      circuito_ingreso_ids: Array.isArray(versionData?.bloque_workflow_sla_cobertura?.circuito_ingreso_ids)
        ? versionData.bloque_workflow_sla_cobertura.circuito_ingreso_ids.map((x) => String(x || "").trim()).filter(Boolean)
        : [],
      elegible_titular: eleg.ok === true,
      elegibilidad_codigos: Array.isArray(eleg.codigos) ? eleg.codigos : [],
      elegibilidad_mensajes: Array.isArray(eleg.mensajes) ? eleg.mensajes : [],
      /** Átomo escritura: alta directa RRHH solo Art. 77-0. */
      alta_disponible:
        rol === "CFG_RRHH" && String(core.codigo || "").trim().toUpperCase() === "77-0",
    });
  }

  articulos.sort((a, b) => String(a.codigo_grilla).localeCompare(String(b.codigo_grilla), "es"));

  return {
    articulos,
    rol_actor: rol,
    fecha_desde: fechaDesde,
    titular_persona_id: titularPersonaId,
    actor_persona_id: actorPersonaId,
    meta: {
      candidatos_evaluados: candidatos.length,
      sin_allowlist_etapa1: true,
    },
  };
}

module.exports = {
  ROLES_CIRCUITO_CANONICOS,
  ROLES_TITULAR_AJENO,
  normalizarRolCircuito,
  tokenIncluyeRolCircuito,
  puedeConsultarTitularAjeno,
  versionIncluyeRolEnCircuito,
  esArticuloOperativo,
  versionPublicadaEsMasReciente,
  patronDesdeVersion,
  evaluarElegibilidadTitular,
  discoverArticulosVersionPublicada,
  listarArticulosIngresoPorRol,
};

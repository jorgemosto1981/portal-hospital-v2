"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Opciones de consumo por solicitud (versión cfg_articulos) — 63.j duelo y similares.
 * @see docs/v2/RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md §2.1
 */

/** @typedef {{
 *   id: string,
 *   etiqueta_ui: string,
 *   codigo_sarh?: string,
 *   dias_por_evento: number,
 *   regla_computo_id?: string | null,
 *   activo?: boolean,
 * }} OpcionConsumoSolicitudRow
 */

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @returns {OpcionConsumoSolicitudRow[]}
 */
function leerOpcionesConsumoDesdeVersion(versionData) {
  if (!versionData || typeof versionData !== "object") return [];
  const raw = versionData.opciones_consumo_solicitud;
  if (!Array.isArray(raw)) return [];
  /** @type {OpcionConsumoSolicitudRow[]} */
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.id || "").trim();
    if (!id) continue;
    const dias = Number(row.dias_por_evento);
    out.push({
      id,
      etiqueta_ui: String(row.etiqueta_ui || "").trim(),
      codigo_sarh: row.codigo_sarh != null ? String(row.codigo_sarh).trim() : undefined,
      dias_por_evento: Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 1,
      regla_computo_id:
        row.regla_computo_id != null && String(row.regla_computo_id).trim()
          ? String(row.regla_computo_id).trim()
          : null,
      activo: row.activo !== false,
    });
  }
  return out;
}

/**
 * @param {OpcionConsumoSolicitudRow[]} opciones
 */
function filtrarOpcionesActivas(opciones) {
  return opciones.filter((o) => o.activo !== false);
}

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 */
function versionTieneOpcionesConsumoActivas(versionData) {
  return filtrarOpcionesActivas(leerOpcionesConsumoDesdeVersion(versionData)).length > 0;
}

/**
 * Patrón B sin cupo anual: límite por evento vía opciones (63.j duelo).
 * @param {Record<string, unknown> | null | undefined} versionData
 */
function esArticuloPatronBPorEventoSinTopeAnual(versionData) {
  const topes =
    versionData && typeof versionData === "object" ? versionData.bloque_topes_plazos_computo || {} : {};
  if (topes.cupo_dias_por_ciclo != null) return false;
  return versionTieneOpcionesConsumoActivas(versionData);
}

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @param {string | null | undefined} opcionConsumoId
 * @returns {{ ok: true, opcion: OpcionConsumoSolicitudRow } | { ok: false, codigo: string }}
 */
function resolverOpcionConsumo(versionData, opcionConsumoId) {
  const activas = filtrarOpcionesActivas(leerOpcionesConsumoDesdeVersion(versionData));
  if (!activas.length) {
    return { ok: false, codigo: "SIN_OPCIONES_CONSUMO" };
  }
  const id = String(opcionConsumoId || "").trim();
  if (!id) {
    return { ok: false, codigo: "OPCION_CONSUMO_REQUERIDA" };
  }
  const opcion = activas.find((o) => o.id === id);
  if (!opcion) {
    return { ok: false, codigo: "OPCION_CONSUMO_INVALIDA" };
  }
  return { ok: true, opcion };
}

/**
 * Regla de cómputo efectiva: fila `regla_computo_id` o bloque 4 de la versión.
 * @param {OpcionConsumoSolicitudRow} opcion
 * @param {Record<string, unknown>} versionData
 */
function reglaComputoDiasIdDesdeOpcion(opcion, versionData) {
  const desdeOpcion = opcion.regla_computo_id && String(opcion.regla_computo_id).trim();
  if (desdeOpcion) return desdeOpcion;
  const topes =
    versionData && typeof versionData === "object" ? versionData.bloque_topes_plazos_computo || {} : {};
  const desdeBloque = String(topes.regla_computo_dias_id || "").trim();
  return desdeBloque || "cfg_rcd_corridos";
}

/**
 * Versión con bloque 4 ajustado a la opción elegida (motor / fechas).
 * @param {Record<string, unknown>} versionData
 * @param {OpcionConsumoSolicitudRow} opcion
 */
function versionDataConOpcionAplicada(versionData, opcion) {
  const base = versionData && typeof versionData === "object" ? versionData : {};
  const topes = { ...(base.bloque_topes_plazos_computo || {}) };
  const reglaId = reglaComputoDiasIdDesdeOpcion(opcion, base);
  topes.regla_computo_dias_id = reglaId;
  topes.usa_calendario_institucional = reglaId !== "cfg_rcd_corridos";
  topes.tope_dias_por_evento = opcion.dias_por_evento;
  return {
    ...base,
    bloque_topes_plazos_computo: topes,
  };
}

/**
 * Payload seguro para listado ticketera (wizard).
 * @param {Record<string, unknown> | null | undefined} versionData
 */
function mapOpcionesParaListadoCliente(versionData) {
  return filtrarOpcionesActivas(leerOpcionesConsumoDesdeVersion(versionData)).map((o) => ({
    id: o.id,
    etiqueta_ui: o.etiqueta_ui,
    dias_por_evento: o.dias_por_evento,
    regla_computo_dias_id: reglaComputoDiasIdDesdeOpcion(o, versionData || {}),
    codigo_sarh: o.codigo_sarh || null,
  }));
}

const CODIGOS_CONSUMO = {
  SIN_OPCIONES_CONSUMO: "SIN_OPCIONES_CONSUMO",
  OPCION_CONSUMO_REQUERIDA: "OPCION_CONSUMO_REQUERIDA",
  OPCION_CONSUMO_INVALIDA: "OPCION_CONSUMO_INVALIDA",
  DIAS_NO_COINCIDEN_OPCION: "DIAS_NO_COINCIDEN_OPCION",
};

/**
 * Resuelve versión efectiva y días para motor Patrón B / preview.
 * @param {Record<string, unknown>} versionData
 * @param {Record<string, unknown>} solicitud
 */
function resolvePatronBConsumoDesdeSolicitud(versionData, solicitud) {
  const tieneOpciones = versionTieneOpcionesConsumoActivas(versionData);
  if (!tieneOpciones) {
    const diasRaw = Number(solicitud.dias_solicitados);
    const diasPedidos =
      Number.isFinite(diasRaw) && diasRaw > 0 ? Math.floor(diasRaw) : 1;
    return {
      ok: true,
      versionEff: versionData,
      diasPedidos,
      opcion: null,
      opcion_consumo_id: null,
    };
  }

  const opcionId =
    typeof solicitud.opcion_consumo_id === "string" ? solicitud.opcion_consumo_id.trim() : "";
  const res = resolverOpcionConsumo(versionData, opcionId);
  if (!res.ok) {
    return { ok: false, codigo: res.codigo };
  }

  const diasPedidos = res.opcion.dias_por_evento;
  const diasPayload = Number(solicitud.dias_solicitados);
  if (
    Number.isFinite(diasPayload) &&
    diasPayload > 0 &&
    Math.floor(diasPayload) !== diasPedidos
  ) {
    return { ok: false, codigo: CODIGOS_CONSUMO.DIAS_NO_COINCIDEN_OPCION };
  }

  return {
    ok: true,
    versionEff: versionDataConOpcionAplicada(versionData, res.opcion),
    diasPedidos,
    opcion: res.opcion,
    opcion_consumo_id: res.opcion.id,
  };
}

module.exports = { CODIGOS_CONSUMO, leerOpcionesConsumoDesdeVersion, filtrarOpcionesActivas, versionTieneOpcionesConsumoActivas, esArticuloPatronBPorEventoSinTopeAnual, resolverOpcionConsumo, reglaComputoDiasIdDesdeOpcion, versionDataConOpcionAplicada, mapOpcionesParaListadoCliente, resolvePatronBConsumoDesdeSolicitud };

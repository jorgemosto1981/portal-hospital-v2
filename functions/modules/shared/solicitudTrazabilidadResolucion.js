"use strict";

/**
 * Cómo evolucionó el trámite hasta su resolución: el cruce de modalidad de la
 * familia Art. 64 y la derivación a Art. 77-0 por rechazo.
 *
 * Se arma con lo que ya guarda el propio documento, sin recorrer
 * `eventos_ticket`. Alcanza para que RRHH entienda por qué el artículo final no
 * es el del alta, que es el caso que hoy se lee mal en la bandeja: el cruce a
 * sin goce reescribe `articulo_id` y no queda rastro visible del original.
 */

const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} cruce — `sol.cruce_modalidad_64`
 * @param {Map} articuloCache
 */
async function detalleCruceModalidad64(db, cruce, articuloCache) {
  const origenId = String(cruce.articulo_origen_id || "").trim();
  const destinoId = String(cruce.articulo_destino_id || "").trim();
  const [origen, destino] = await Promise.all([
    loadArticuloDisplay(db, origenId, articuloCache),
    loadArticuloDisplay(db, destinoId, articuloCache),
  ]);
  return {
    de: String(cruce.de || "").trim() || null,
    a: String(cruce.a || "").trim() || null,
    articulo_origen_id: origenId || null,
    articulo_destino_id: destinoId || null,
    codigo_origen: origen.codigo_grilla || null,
    codigo_destino: destino.codigo_grilla || null,
    dias: Number(cruce.dias) > 0 ? Math.floor(Number(cruce.dias)) : null,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {Map} articuloCache
 * @returns {Promise<Record<string, unknown> | null>} null si el trámite siguió
 *   su curso sin cruces ni derivaciones: no hay nada que trazar.
 */
async function trazabilidadResolucionSolicitud(db, sol, articuloCache) {
  const cruce = sol.cruce_modalidad_64;
  const derivada = String(sol.art_77_0_derivada_id || "").trim();
  const origenRechazo = String(sol.origen_rechazo_sol_id || "").trim();
  const derivacionPendiente = sol.art_77_0_derivacion_pendiente === true;

  const hayCruce = Boolean(cruce && typeof cruce === "object");
  if (!hayCruce && !derivada && !origenRechazo && !derivacionPendiente) return null;

  return {
    modalidad_64: hayCruce ? await detalleCruceModalidad64(db, cruce, articuloCache) : null,
    art_77_0_derivada_id: /^sol_/i.test(derivada) ? derivada : null,
    art_77_0_derivacion_pendiente: derivacionPendiente,
    art_77_0_derivacion_error: String(sol.art_77_0_derivacion_error || "").trim() || null,
    origen_rechazo_sol_id: /^sol_/i.test(origenRechazo) ? origenRechazo : null,
  };
}

module.exports = { trazabilidadResolucionSolicitud };

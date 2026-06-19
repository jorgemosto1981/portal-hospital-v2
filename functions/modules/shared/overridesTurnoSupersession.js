"use strict";

/**
 * Revocación de overrides manuales previos antes de una nueva mutación (cambio sobre cambio).
 * Mantiene historial: marca eliminado + motivo, no borra físicamente.
 *
 * Traslado propio v2: varios tramos (M, T, …) pueden coexistir si no compiten por el mismo segmento.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function esOverrideActivo(ov) {
  return ov && !ov.eliminado && !ov.invalidado_por_replanificacion;
}

/**
 * @param {Record<string, unknown>} ov
 */
function esTrasladoReemplazoV2(ov) {
  if (!ov || typeof ov !== "object" || ov.tipo !== "reemplazo") return false;
  const leg = String(ov.reemplazo_traslado_v2 || "").trim();
  if (leg === "origen" || leg === "destino") return true;
  if (Array.isArray(ov.segmentos_incorporados_destino) && ov.segmentos_incorporados_destino.length > 0) {
    return true;
  }
  const segs = ov.segmentos_a_trasladar || ov.segmentos_trasladar;
  const fo = String(ov.fecha_origen || "").trim();
  const fd = String(ov.fecha_destino || "").trim();
  return Array.isArray(segs) && segs.length > 0 && YMD.test(fo) && YMD.test(fd) && fo !== fd;
}

/**
 * @param {Record<string, unknown>} ov
 * @returns {Set<string>}
 */
function idsSegmentosTrasladoOverride(ov) {
  if (!ov || typeof ov !== "object") return new Set();
  if (String(ov.reemplazo_traslado_v2 || "") === "destino") {
    const raw = ov.segmentos_incorporados_destino;
    return new Set(
      (Array.isArray(raw) ? raw : [])
        .map((x) => String(x).trim())
        .filter(Boolean),
    );
  }
  const raw = ov.segmentos_a_trasladar || ov.segmentos_trasladar;
  return new Set(
    (Array.isArray(raw) ? raw : [])
      .map((x) => String(x).trim())
      .filter(Boolean),
  );
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
function trasladoV2ComparteSegmento(a, b) {
  const sa = idsSegmentosTrasladoOverride(a);
  const sb = idsSegmentosTrasladoOverride(b);
  if (!sa.size || !sb.size) return true;
  for (const id of sb) {
    if (sa.has(id)) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} existing
 * @param {Array<Record<string, unknown>>} nuevos
 */
function debeRevocarOverridePorNuevasEntradas(existing, nuevos) {
  for (const neu of nuevos) {
    if (!neu || neu.es_override_manual !== true) continue;

    if (neu.tipo === "cobertura_parcial" || neu.tipo === "adicional") {
      if (existing.tipo === "reemplazo" && !esTrasladoReemplazoV2(existing)) return true;
      continue;
    }

    if (neu.tipo !== "reemplazo") continue;

    const neuTras = esTrasladoReemplazoV2(neu);
    const exTras = esTrasladoReemplazoV2(existing);

    if (neuTras && exTras) {
      if (String(neu.reemplazo_traslado_v2 || "") !== String(existing.reemplazo_traslado_v2 || "")) {
        continue;
      }
      if (trasladoV2ComparteSegmento(existing, neu)) return true;
      continue;
    }

    if (neuTras !== exTras) return true;
    return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} ov
 * @param {{ uid?: string, personaId?: string | null, nowIso: string, motivo?: string }} meta
 */
function marcarOverrideSupersedido(ov, meta) {
  const motivo = String(meta.motivo || "").trim()
    || "Reemplazado por nueva operación en la celda (supersession)";
  return {
    ...ov,
    eliminado: true,
    supersedido_por_nueva_op: true,
    eliminado_en: meta.nowIso,
    eliminado_por_uid: meta.uid || "system",
    eliminado_por_persona_id: meta.personaId || null,
    motivo_eliminacion: motivo,
  };
}

/**
 * Revoca overrides manuales que entran en conflicto con las nuevas entradas del mismo gdt.
 * @param {unknown[]} overrides
 * @param {string} gdt
 * @param {{ uid?: string, personaId?: string | null, nowIso: string, motivo?: string }} meta
 * @param {unknown[]} [nuevosEntries]
 */
function revocarOverridesManualesActivosGdt(overrides, gdt, meta, nuevosEntries) {
  const g = String(gdt || "").trim();
  const nuevos = Array.isArray(nuevosEntries) ? nuevosEntries : [];
  return (Array.isArray(overrides) ? overrides : []).map((ov) => {
    if (!esOverrideActivo(ov)) return ov;
    if (ov.es_override_manual !== true) return ov;
    if (String(ov.grupo_de_trabajo_id || "").trim() !== g) return ov;
    if (debeRevocarOverridePorNuevasEntradas(ov, nuevos)) {
      return marcarOverrideSupersedido(ov, meta);
    }
    return ov;
  });
}

/**
 * @param {unknown[]} current
 * @param {unknown[]} nuevosEntries
 * @param {string} gdt
 * @param {{ uid?: string, personaId?: string | null, nowIso: string, motivo?: string }} meta
 */
function aplicarOverridesConSupersession(current, nuevosEntries, gdt, meta) {
  const extra = Array.isArray(nuevosEntries) ? nuevosEntries : [];
  const revoked = revocarOverridesManualesActivosGdt(current, gdt, meta, extra);
  return [...revoked, ...extra];
}

const PER_ID = /^per_[A-Z0-9]+$/i;

/**
 * Claves asi `persona_id|fecha` con cobertura parcial activa que involucran a alguna persona del set.
 * @param {Map<string, import("firebase-admin/firestore").DocumentSnapshot>} asiMap
 * @param {Set<string>} personaIds
 * @param {string} gdt
 * @returns {Set<string>}
 */
function collectAsiKeysCoberturaPeers(asiMap, personaIds, gdt) {
  const g = String(gdt || "").trim();
  const keys = new Set();
  if (!asiMap || !personaIds?.size) return keys;
  for (const [key, snap] of asiMap.entries()) {
    const overrides = snap?.exists && Array.isArray(snap.data()?.overrides_turno)
      ? snap.data().overrides_turno
      : [];
    for (const ov of overrides) {
      if (!esOverrideActivo(ov)) continue;
      if (String(ov.grupo_de_trabajo_id || "").trim() !== g) continue;
      if (ov.tipo !== "cobertura_parcial") continue;
      const po = String(ov.persona_origen_id || "").trim();
      const pc = String(ov.persona_cobertura_id || "").trim();
      if (personaIds.has(po) || personaIds.has(pc)) {
        keys.add(key);
        break;
      }
    }
  }
  return keys;
}

/**
 * Pares persona×fecha×gdt a rematerializar tras un override registrado (callable legacy).
 * @param {{ personaId: string, fechaYmd: string, grupoId: string, override?: Record<string, unknown> }} args
 */
function paresMaterializacionDesdeOverrideRegistro(args) {
  const personaId = String(args.personaId || "").trim();
  const fechaYmd = String(args.fechaYmd || "").trim();
  const gdt = String(args.grupoId || "").trim();
  const ov = args.override && typeof args.override === "object" ? args.override : {};
  /** @type {Array<{ personaId: string, fechaYmd: string, grupoId: string }>} */
  const out = [];

  if (ov.tipo === "cobertura_parcial") {
    const fo = String(ov.fecha_origen || fechaYmd).trim().slice(0, 10);
    const fd = String(ov.fecha_destino || fechaYmd).trim().slice(0, 10);
    const po = String(ov.persona_origen_id || personaId).trim();
    const pc = String(ov.persona_cobertura_id || "").trim();
    if (PER_ID.test(po) && YMD.test(fo)) out.push({ personaId: po, fechaYmd: fo, grupoId: gdt });
    if (PER_ID.test(pc) && YMD.test(fd)) out.push({ personaId: pc, fechaYmd: fd, grupoId: gdt });
    return out;
  }

  if (ov.tipo === "reemplazo") {
    const fo = String(ov.fecha_origen || ov.fecha_origen_ymd || "").trim().slice(0, 10);
    const fd = String(ov.fecha_destino || fechaYmd).trim().slice(0, 10);
    const fechas = new Set();
    if (YMD.test(fo)) fechas.add(fo);
    if (YMD.test(fd)) fechas.add(fd);
    if (!fechas.size && YMD.test(fechaYmd)) fechas.add(fechaYmd);
    for (const f of fechas) {
      out.push({ personaId, fechaYmd: f, grupoId: gdt });
    }
    return out;
  }

  if (PER_ID.test(personaId) && YMD.test(fechaYmd)) {
    out.push({ personaId, fechaYmd, grupoId: gdt });
  }
  return out;
}

module.exports = {
  esOverrideActivo,
  esTrasladoReemplazoV2,
  marcarOverrideSupersedido,
  revocarOverridesManualesActivosGdt,
  aplicarOverridesConSupersession,
  collectAsiKeysCoberturaPeers,
  paresMaterializacionDesdeOverrideRegistro,
};

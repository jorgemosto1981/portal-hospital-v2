"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Exclusividad de tramos en intercambio de guardia v2 (misma regla UI + batch).
 */

/**
 * @param {Array<{ segmento_id?: string; persona_titular_id?: string; persona_ejecutante_id?: string }>} segmentos
 * @param {string} personaId
 * @returns {string[]}
 */
function segmentoIdsEjecutablesTitular(segmentos, personaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return [];
  return (segmentos || [])
    .filter((s) => {
      const tit = String(s?.persona_titular_id || pid).trim();
      const ej = String(s?.persona_ejecutante_id || pid).trim();
      return tit === pid && ej === pid;
    })
    .map((s) => String(s?.segmento_id || "").trim())
    .filter(Boolean);
}

/**
 * @param {string[]} idsPost
 * @param {Array<{ segmento_id?: string; ingreso_iso?: string; egreso_iso?: string }>} segmentosCapa
 */
function validarSolapeHorarioTramosPostSwap(idsPost, segmentosCapa = []) {
  const ids = [...new Set((idsPost || []).map(String).filter(Boolean))];
  if (ids.length < 2) return { ok: true };

  const byId = new Map();
  for (const s of segmentosCapa || []) {
    const id = String(s?.segmento_id || "").trim();
    if (id && !byId.has(id)) byId.set(id, s);
  }

  /** @type {Array<{ id: string, ini: number, fin: number }>} */
  const ventanas = [];
  for (const id of ids) {
    const seg = byId.get(id);
    if (!seg?.ingreso_iso || !seg?.egreso_iso) continue;
    const ini = new Date(seg.ingreso_iso).getTime();
    const fin = new Date(seg.egreso_iso).getTime();
    if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) continue;
    ventanas.push({ id, ini, fin });
  }

  if (ventanas.length < 2) return { ok: true };

  for (let i = 0; i < ventanas.length; i += 1) {
    for (let j = i + 1; j < ventanas.length; j += 1) {
      const a = ventanas[i];
      const b = ventanas[j];
      if (a.ini < b.fin && b.ini < a.fin) {
        return {
          ok: false,
          error: `Los tramos ${a.id} y ${b.id} se solapan horariamente tras el intercambio.`,
        };
      }
    }
  }
  return { ok: true };
}

/**
 * @param {{
 *   idsEjecutables: string[];
 *   segmentosCedidos: string[];
 *   segmentosRecibidos: string[];
 *   segmentosCapa?: Array<Record<string, unknown>>;
 *   segmentosCapaPeer?: Array<Record<string, unknown>>;
 *   ladoLabel?: string;
 * }} params
 */
function validarExclusividadTramosIntercambio({
  idsEjecutables,
  segmentosCedidos,
  segmentosRecibidos,
  segmentosCapa = [],
  segmentosCapaPeer = [],
  ladoLabel = "",
}) {
  const pref = ladoLabel ? `${ladoLabel}: ` : "";
  const cedSet = new Set((segmentosCedidos || []).map(String));
  const conserva = (idsEjecutables || []).filter((id) => !cedSet.has(String(id)));
  const recibidos = [...new Set((segmentosRecibidos || []).map(String).filter(Boolean))];

  for (const r of recibidos) {
    if (conserva.includes(r)) {
      return {
        ok: false,
        error: `${pref}Ya tenés el tramo ${r} asignado ese día; no podés recibirlo en un intercambio.`,
      };
    }
  }

  const idsPost = [...conserva];
  for (const r of recibidos) {
    if (!idsPost.includes(r)) idsPost.push(r);
  }
  if (idsPost.length !== new Set(idsPost).size) {
    return {
      ok: false,
      error: `${pref}El intercambio duplicaría un tramo en el mismo día.`,
    };
  }

  const capaSolape = [...(segmentosCapa || [])];
  for (const s of segmentosCapaPeer || []) {
    const id = String(s?.segmento_id || "").trim();
    if (!id || !idsPost.includes(id)) continue;
    if (!capaSolape.some((x) => String(x?.segmento_id || "") === id)) {
      capaSolape.push(s);
    }
  }

  const solape = validarSolapeHorarioTramosPostSwap(idsPost, capaSolape);
  if (!solape.ok) {
    return { ok: false, error: `${pref}${solape.error}` };
  }

  return { ok: true, idsPost };
}

module.exports = { segmentoIdsEjecutablesTitular, validarSolapeHorarioTramosPostSwap, validarExclusividadTramosIntercambio };

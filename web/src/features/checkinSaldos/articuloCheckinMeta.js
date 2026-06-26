import { CFG_EST_VER_PUBLICADA, getCorrespondenciaAnioFromVersion } from "../../../../shared/utils/laoVersionResolver.js";
import { esArticuloPatronBSinCupoAnualCiclo } from "../../../../shared/utils/opcionesConsumoSolicitud.js";
import { callListarVersionesCfgArticulo } from "../../services/callables.js";
import { resolvePatronSaldo } from "./resolvePatronSaldo.js";

/** @type {Map<string, { patron: 'A'|'B'|'C'|null, versionId: string, cupoDiasPorCiclo: number | null, validacionSinCupoAnual: boolean, error: string | null }>} */
const metaCache = new Map();

function cacheKey(articuloId, anioA) {
  return `${String(articuloId).trim()}:${anioA == null ? "_" : anioA}`;
}

/** Limpia cache de meta (p. ej. tras publicar versión en otra pestaña). */
export function clearArticuloCheckinMetaCache() {
  metaCache.clear();
}

/**
 * @returns {Promise<{ patron: 'A'|'B'|'C'|null, versionId: string, cupoDiasPorCiclo: number | null, validacionSinCupoAnual: boolean, error: string | null }>}
 */
export async function fetchArticuloCheckinMeta(articuloId, anioA) {
  const art = String(articuloId || "").trim();
  if (!/^art_/i.test(art)) {
    return { patron: null, versionId: "", cupoDiasPorCiclo: null, validacionSinCupoAnual: false, error: "Artículo inválido." };
  }

  const key = cacheKey(art, anioA);
  if (metaCache.has(key)) return metaCache.get(key);

  try {
    const res = await callListarVersionesCfgArticulo({ articuloId: art });
    const items =
      res?.data && typeof res.data === "object" && Array.isArray(res.data.items) ? res.data.items : [];

    const publicadas = items.filter(
      (it) => it?.data && String(it.data.estado_version_id || "").trim() === CFG_EST_VER_PUBLICADA,
    );

    if (!publicadas.length) {
      const out = {
        patron: null,
        versionId: "",
        cupoDiasPorCiclo: null,
        validacionSinCupoAnual: false,
        error: "Sin versión publicada.",
      };
      metaCache.set(key, out);
      return out;
    }

    let pick = publicadas[0];
    if (anioA != null) {
      const match = publicadas.find((it) => getCorrespondenciaAnioFromVersion(it.data) === anioA);
      if (match) pick = match;
    }

    const data = pick.data || {};
    const ident = data.bloque_identidad_naturaleza || {};
    const topes = data.bloque_topes_plazos_computo || {};
    const esLao = ident.es_lao_anual === true;
    const patron = resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, esLao);
    const cupoRaw = topes.cupo_dias_por_ciclo;
    const cupo =
      cupoRaw != null && Number.isFinite(Number(cupoRaw)) ? Number(cupoRaw) : null;
    const verId = String(pick.versionId || "").trim();

    const validacionSinCupoAnual =
      patron === "B" && cupo == null && esArticuloPatronBSinCupoAnualCiclo(data);

    const out = {
      patron,
      versionId: verId,
      cupoDiasPorCiclo: cupo,
      validacionSinCupoAnual,
      error: patron ? null : "Patrón no reconocido en configurador.",
    };
    metaCache.set(key, out);
    return out;
  } catch (e) {
    const out = {
      patron: null,
      versionId: "",
      cupoDiasPorCiclo: null,
      validacionSinCupoAnual: false,
      error: e?.message || "No se pudo leer versiones.",
    };
    metaCache.set(key, out);
    return out;
  }
}

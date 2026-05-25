import { useCallback, useEffect, useMemo, useState } from "react";

import { callObtenerContextoBolsaLaoAgente } from "../../services/callables.js";

const ART_RE = /^art_[0-9A-HJKMNP-TV-Z]{26}$/i;

function formatCallableError(err) {
  const msg = err && typeof err.message === "string" ? err.message : "No se pudo cargar la bolsa LAO.";
  const code = err && typeof err.code === "string" ? err.code : "";
  return code ? `${code}: ${msg}` : msg;
}

/**
 * Contexto paso 1 wizard LAO (`obtenerContextoBolsaLaoAgente`).
 * @param {{ articuloId: string, personaId?: string, anioOrigenBolsa?: number | string | null, enabled?: boolean }} params
 */
export function useLaoContext({ articuloId, personaId = "", anioOrigenBolsa = null, enabled = true }) {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const artOk = useMemo(() => ART_RE.test(String(articuloId || "").trim()), [articuloId]);
  const perOk = useMemo(() => /^per_/i.test(String(personaId || "").trim()), [personaId]);
  const anioNum = useMemo(() => {
    if (anioOrigenBolsa == null || anioOrigenBolsa === "") return null;
    const y = Number(anioOrigenBolsa);
    return Number.isInteger(y) && y >= 1900 ? y : null;
  }, [anioOrigenBolsa]);

  const refetch = useCallback(async () => {
    if (!artOk || !perOk) {
      setRaw(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        articulo_id: articuloId.trim(),
        persona_id: String(personaId).trim(),
      };
      if (anioNum != null) payload.anio_origen_bolsa = anioNum;
      const res = await callObtenerContextoBolsaLaoAgente(payload);
      setRaw(res?.data ?? null);
    } catch (err) {
      setRaw(null);
      setError(formatCallableError(err));
    } finally {
      setLoading(false);
    }
  }, [artOk, perOk, articuloId, personaId, anioNum]);

  useEffect(() => {
    if (!enabled || !artOk || !perOk) {
      setRaw(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [enabled, artOk, perOk, refetch]);

  const resumen = raw?.resumen_disponibilidad_lao ?? null;
  const okCallable = raw?.ok === true && resumen?.ok === true;

  return {
    resumen,
    okCallable,
    raw,
    error,
    loading,
    refetch,
    puedeConsultar: enabled && artOk && perOk,
  };
}

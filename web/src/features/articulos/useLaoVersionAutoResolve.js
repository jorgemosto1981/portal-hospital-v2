import { useEffect, useState } from "react";

import { resolvePublishedLaoVersionId } from "../../services/laoVersionResolverService.js";

/**
 * Autocompleta version_aplicada_id cuando cambian artículo y año de bolsa.
 */
export function useLaoVersionAutoResolve({ articuloId, anioOrigenBolsa, onResolvedVersionId }) {
  const [resolviendo, setResolviendo] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const art = articuloId.trim();
    const anio = Number(anioOrigenBolsa);
    if (!/^art_/i.test(art) || !Number.isInteger(anio) || anio < 1900) {
      setError(null);
      setResolviendo(false);
      return;
    }

    let cancelled = false;
    setResolviendo(true);
    setError(null);

    void resolvePublishedLaoVersionId(art, anio)
      .then((pick) => {
        if (cancelled) return;
        if (!pick) {
          setError(`No hay versión LAO publicada para el ejercicio ${anio}.`);
          return;
        }
        onResolvedVersionId(pick.versionId);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo resolver la versión.");
      })
      .finally(() => {
        if (!cancelled) setResolviendo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articuloId, anioOrigenBolsa, onResolvedVersionId]);

  return { resolviendo, errorVersion: error };
}

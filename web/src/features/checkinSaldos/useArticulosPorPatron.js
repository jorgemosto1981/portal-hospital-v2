import { useEffect, useState } from "react";

import { fetchArticuloCheckinMeta } from "./articuloCheckinMeta.js";

/**
 * Clasifica artículos vigentes por patrón solo cuando la pestaña está activa (carga diferida).
 * @param {import('./useArticulosActivosCheckin.js').ArticuloCheckinRow[]} articulos
 * @param {'A'|'B'|'C'} patronObjetivo
 * @param {number | null} anioA
 * @param {boolean} enabled
 */
export function useArticulosPorPatron(articulos, patronObjetivo, anioA, enabled) {
  const [articulosPatron, setArticulosPatron] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || anioA == null || !articulos.length) {
      setArticulosPatron([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const out = [];
      for (const a of articulos) {
        if (cancelled) return;
        const meta = await fetchArticuloCheckinMeta(a.id, anioA);
        if (meta.patron === patronObjetivo) {
          out.push({
            ...a,
            versionId: meta.versionId,
            cupoDiasPorCiclo: meta.cupoDiasPorCiclo,
            metaError: meta.error,
          });
        }
      }
      if (!cancelled) {
        setArticulosPatron(out);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articulos, patronObjetivo, anioA, enabled]);

  return { articulosPatron, loadingPatronList: loading };
}

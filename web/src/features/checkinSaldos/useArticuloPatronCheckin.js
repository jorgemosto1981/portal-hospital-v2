import { useEffect, useState } from "react";

import { CFG_EST_VER_PUBLICADA } from "../../../../shared/utils/laoVersionResolver.js";
import { loadVersionesSubcoleccion } from "../../services/articuloVersionesListService.js";

/**
 * @param {string} articuloId
 */
export function useArticuloPatronCheckin(articuloId) {
  const [esPatronLao, setEsPatronLao] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const art = String(articuloId || "").trim();
    if (!/^art_/i.test(art)) {
      setEsPatronLao(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadVersionesSubcoleccion(art)
      .then((rows) => {
        if (cancelled) return;
        const publicadas = rows.filter((r) => r.estadoVersionId === CFG_EST_VER_PUBLICADA);
        setEsPatronLao(publicadas.some((r) => r.esLaoAnual === true));
      })
      .catch(() => {
        if (!cancelled) setEsPatronLao(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articuloId]);

  return { esPatronLao, loadingPatron: loading };
}

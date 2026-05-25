import { useEffect, useState } from "react";

import { CFG_EST_VER_PUBLICADA } from "../../../../shared/utils/laoVersionResolver.js";
import { callListarVersionesCfgArticulo } from "../../services/callables.js";
import { getCorrespondenciaAnioFromVersion } from "../../../../shared/utils/laoVersionResolver.js";
import { resolvePatronSaldo } from "./resolvePatronSaldo.js";

/**
 * Patrón y cupo desde versión **publicada** (RFC §1), no heurística “¿es LAO?”.
 * @param {string} articuloId
 * @param {number | null} anioA
 */
export function useArticuloCheckinConfig(articuloId, anioA) {
  const [loading, setLoading] = useState(false);
  const [patron, setPatron] = useState(null);
  const [versionId, setVersionId] = useState("");
  const [cupoDiasPorCiclo, setCupoDiasPorCiclo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const art = String(articuloId || "").trim();
    if (!/^art_/i.test(art)) {
      setPatron(null);
      setVersionId("");
      setCupoDiasPorCiclo(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void callListarVersionesCfgArticulo({ articuloId: art })
      .then((res) => {
        if (cancelled) return;
        const items =
          res?.data && typeof res.data === "object" && Array.isArray(res.data.items) ? res.data.items : [];

        const publicadas = items.filter(
          (it) =>
            it?.data &&
            String(it.data.estado_version_id || "").trim() === CFG_EST_VER_PUBLICADA,
        );

        if (!publicadas.length) {
          setPatron(null);
          setVersionId("");
          setCupoDiasPorCiclo(null);
          setError("No hay versión publicada. Publicá una versión en el configurador.");
          return;
        }

        let pick = publicadas[0];
        if (anioA != null) {
          const match = publicadas.find(
            (it) => getCorrespondenciaAnioFromVersion(it.data) === anioA,
          );
          if (match) pick = match;
        }

        const data = pick.data || {};
        const ident = data.bloque_identidad_naturaleza || {};
        const topes = data.bloque_topes_plazos_computo || {};
        const esLao = ident.es_lao_anual === true;
        const p = resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, esLao);
        const cupo = topes.cupo_dias_por_ciclo;
        const verId = String(pick.versionId || "").trim();

        setVersionId(verId);
        setPatron(p);
        setCupoDiasPorCiclo(cupo != null && Number.isFinite(Number(cupo)) ? Number(cupo) : null);
        setError(p ? null : "Revisá reinicio de ciclo y origen del saldo en Impacto y saldo.");
      })
      .catch((e) => {
        if (cancelled) return;
        setPatron(null);
        setError(e?.message || "No se pudo leer versiones del artículo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articuloId, anioA]);

  const esPatronLao = patron === "A";

  return { loading, patron, esPatronLao, versionId, cupoDiasPorCiclo, error };
}

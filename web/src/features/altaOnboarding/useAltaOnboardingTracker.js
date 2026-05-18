import { useEffect, useMemo, useState } from "react";

import { callObtenerResumenAltaOnboardingPersona } from "../../services/callables.js";
import { evalAltaOnboardingPasos } from "./evalAltaOnboardingPasos.js";

/**
 * Carga persona y resumen acotado (cuenta + HLc) para los 3 pasos de alta RRHH.
 * @param {string} personaId
 */
export function useAltaOnboardingTracker(personaId) {
  const per = String(personaId || "").trim();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {Error | null} */ (null));
  const [personaDoc, setPersonaDoc] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [tieneCuenta, setTieneCuenta] = useState(false);
  const [hlcOperativos, setHlcOperativos] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!/^per_/i.test(per)) {
      setPersonaDoc(null);
      setTieneCuenta(false);
      setHlcOperativos(0);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resumen = await callObtenerResumenAltaOnboardingPersona({ persona_id: per });
        if (cancelled) return;

        const data = resumen?.data || {};
        setPersonaDoc(data.persona && typeof data.persona === "object" ? data.persona : null);
        setTieneCuenta(data.tiene_cuenta === true);
        setHlcOperativos(Number(data.hlc_operativos) || 0);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [per, refreshKey]);

  const evalResult = useMemo(
    () => evalAltaOnboardingPasos(personaDoc, { tieneCuenta, hlcOperativos }),
    [personaDoc, tieneCuenta, hlcOperativos],
  );

  const refetch = () => setRefreshKey((k) => k + 1);

  return {
    personaId: per,
    loading,
    error,
    personaDoc,
    tieneCuenta,
    hlcOperativos,
    refetch,
    ...evalResult,
  };
}

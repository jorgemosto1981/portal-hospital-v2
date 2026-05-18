import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../config/firebase.js";
import { callListarColeccion } from "../../services/callables.js";
import { evalAltaOnboardingPasos, isHlcOperativo } from "./evalAltaOnboardingPasos.js";

/**
 * Carga persona, cuenta y HLc operativos para evaluar los 3 pasos de alta RRHH.
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
        const [personaSnap, rCuentas, rHlc] = await Promise.all([
          getDoc(doc(db, "personas", per)),
          callListarColeccion({ collectionName: "usuarios_cuenta" }),
          callListarColeccion({ collectionName: "historial_laboral_cargos" }),
        ]);
        if (cancelled) return;

        setPersonaDoc(personaSnap.exists() ? personaSnap.data() : null);

        const cuentas = (rCuentas?.data?.items) || [];
        setTieneCuenta(
          cuentas.some((u) => String(u?.persona_id || "").trim() === per),
        );

        const hlcs = (rHlc?.data?.items) || [];
        const count = hlcs.filter(
          (row) => String(row?.persona_id || "").trim() === per && isHlcOperativo(row),
        ).length;
        setHlcOperativos(count);
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

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { fetchPersonaCheckinRrhh } from "./fetchPersonaCheckinRrhh.js";

/**
 * Estado del agente vía callable RRHH (sin lectura directa de `personas`).
 * @param {string} personaId
 * @param {(v: string) => void} setAnioCorteA
 */
export function useCheckinPersonaDatos(personaId, setAnioCorteA) {
  const [personaData, setPersonaData] = useState(null);
  const [loadingPersonaData, setLoadingPersonaData] = useState(false);

  const refreshPersona = useCallback(async (per) => {
    const { persona } = await fetchPersonaCheckinRrhh(per);
    setPersonaData(persona);
  }, []);

  const clearPersonaDatos = useCallback(() => {
    setPersonaData(null);
    setLoadingPersonaData(false);
  }, []);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per)) return;
    let cancelled = false;
    setLoadingPersonaData(true);
    void fetchPersonaCheckinRrhh(per)
      .then(({ persona, anioCortePortalA }) => {
        if (cancelled) return;
        setPersonaData(persona);
        if (anioCortePortalA != null) setAnioCorteA(String(anioCortePortalA));
      })
      .catch((e) => {
        if (!cancelled) {
          setPersonaData(null);
          const code = e?.code ? String(e.code) : "";
          if (code.includes("permission-denied")) {
            toast.error(
              "Sin permiso RRHH para leer la persona. Cerrá sesión, volvé a entrar o ejecutá dev:set-rrhh-claims.",
            );
          } else {
            toast.error(e?.message || "No se pudo cargar el estado del agente.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPersonaData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId, setAnioCorteA]);

  return { personaData, loadingPersonaData, refreshPersona, clearPersonaDatos };
}

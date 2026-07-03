import { useEffect, useState } from "react";

import { callListarCie10BandejaAuditor } from "../../services/callables.js";

/**
 * Catálogo cfg_cie10 para bandeja auditor (callable dedicado C2).
 */
export function useCie10Catalogo() {
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCargando(true);
      setError("");
      try {
        const res = await callListarCie10BandejaAuditor();
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!cancelled) setOpciones(items);
      } catch (e) {
        if (!cancelled) {
          setOpciones([]);
          setError(e?.message || "No se pudo cargar el catálogo CIE-10.");
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { opciones, cargando, error };
}

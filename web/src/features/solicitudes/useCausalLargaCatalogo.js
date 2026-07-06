import { useEffect, useState } from "react";

import { callListarCausalLargaBandejaAuditor } from "../../services/callables.js";

/** Catálogo cfg_causal_larga_duracion para bandeja auditor (C2). */
export function useCausalLargaCatalogo() {
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCargando(true);
      setError("");
      try {
        const res = await callListarCausalLargaBandejaAuditor();
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!cancelled) setOpciones(items);
      } catch (e) {
        if (!cancelled) {
          setOpciones([]);
          setError(e?.message || "No se pudo cargar causales Art. 19.");
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

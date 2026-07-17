import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";

import { dbV2 } from "../../services/firebase.js";
import { tipoAcusePendiente } from "./misSolicitudesUi.js";

/**
 * Cola reactiva de novedades del titular sin acuse (rechazo / 64 sin goce).
 * Ventana 3 meses.
 * @param {string} personaId
 */
export function useRechazosPendientesAcuse(personaId) {
  const pid = String(personaId || "").trim();
  const [rows, setRows] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [ready, setReady] = useState(false);
  /** IDs acusados en esta sesión hasta que llega el snapshot (evita UI trabada). */
  const [excluidos, setExcluidos] = useState(/** @type {Set<string>} */ (() => new Set()));

  useEffect(() => {
    setExcluidos(new Set());
    if (!/^per_/i.test(pid)) {
      setRows([]);
      setReady(true);
      return undefined;
    }
    setReady(false);
    const q = query(
      collection(dbV2, "solicitudes_articulo"),
      where("titular_persona_id", "==", pid),
      limit(120),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        list.sort((a, b) => {
          const ta = a.creado_en?.toMillis?.() ?? (Date.parse(String(a.creado_en || "")) || 0);
          const tb = b.creado_en?.toMillis?.() ?? (Date.parse(String(b.creado_en || "")) || 0);
          return tb - ta;
        });
        const pendientes = list
          .map((s) => {
            const tipo = tipoAcusePendiente(s);
            return tipo ? { ...s, _acuseTipo: tipo } : null;
          })
          .filter(Boolean);
        setRows(pendientes);
        // Limpiar exclusiones ya reflejadas en Firestore.
        setExcluidos((prev) => {
          if (prev.size === 0) return prev;
          const stillPending = new Set(pendientes.map((s) => String(s.id)));
          const next = new Set();
          for (const id of prev) {
            if (stillPending.has(id)) next.add(id);
          }
          return next.size === prev.size ? prev : next;
        });
        setReady(true);
      },
      () => {
        setRows([]);
        setReady(true);
      },
    );
    return () => unsub();
  }, [pid]);

  const marcarAcusadoLocal = useCallback((solId) => {
    const id = String(solId || "").trim();
    if (!id) return;
    setExcluidos((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const pendientes = useMemo(
    () => rows.filter((s) => !excluidos.has(String(s.id))),
    [rows, excluidos],
  );

  const actual = pendientes.length > 0 ? pendientes[0] : null;

  return {
    pendientes,
    actual,
    ready,
    restantes: pendientes.length,
    marcarAcusadoLocal,
  };
}

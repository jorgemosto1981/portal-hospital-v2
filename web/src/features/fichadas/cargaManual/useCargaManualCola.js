import { useCallback, useState } from "react";

const MAX_COLA = 20;

/**
 * Cola de sesión (últimos guardados) para undo y cercanía en memoria.
 */
export function useCargaManualCola() {
  const [items, setItems] = useState([]);
  /** @type {[Map<string, object[]>, Function]} */
  const [marcasColaPorDia, setMarcasColaPorDia] = useState(() => new Map());

  const claveDia = (persona_id, fecha_ymd) => `${persona_id}|${fecha_ymd}`;

  const marcasColaSesion = useCallback(
    (persona_id, fecha_ymd) => marcasColaPorDia.get(claveDia(persona_id, fecha_ymd)) || [],
    [marcasColaPorDia],
  );

  const pushGuardado = useCallback((entry) => {
    setItems((prev) => [entry, ...prev].slice(0, MAX_COLA));
    const key = claveDia(entry.persona_id, entry.fecha_ymd);
    setMarcasColaPorDia((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(key) || [])];
      for (const m of entry.marcasAgregadas || []) arr.push(m);
      next.set(key, arr);
      return next;
    });
  }, []);

  const popUltimo = useCallback(() => {
    let removed = null;
    setItems((prev) => {
      if (!prev.length) return prev;
      removed = prev[0];
      return prev.slice(1);
    });
    return removed;
  }, []);

  const removeById = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const quitarMarcasColaEntrada = useCallback((entry) => {
    if (!entry) return;
    const key = claveDia(entry.persona_id, entry.fecha_ymd);
    setMarcasColaPorDia((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(key) || [])];
      for (const m of entry.marcasAgregadas || []) {
        const idx = arr.findIndex((x) => x.instante_ms === m.instante_ms);
        if (idx >= 0) arr.splice(idx, 1);
      }
      next.set(key, arr);
      return next;
    });
  }, []);

  return {
    colaItems: items,
    pushGuardado,
    popUltimo,
    marcasColaSesion,
    quitarMarcasColaEntrada,
    removeById,
  };
}

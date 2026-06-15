import { useCallback, useMemo, useState } from "react";

/** Máximo de registros pendientes de envío en la cola de sesión. */
export const MAX_COLA_PENDIENTE = 10;
const MAX_HISTORIAL_ENVIADOS = 20;

/**
 * Cola de sesión: precarga local (pendiente) + historial enviado (para deshacer en servidor).
 */
export function useCargaManualCola() {
  const [items, setItems] = useState([]);
  /** @type {[Map<string, object[]>, Function]} */
  const [marcasColaPorDia, setMarcasColaPorDia] = useState(() => new Map());

  const claveDia = (persona_id, fecha_ymd) => `${persona_id}|${fecha_ymd}`;

  const pendientes = useMemo(
    () => items.filter((x) => x.estado === "pendiente"),
    [items],
  );

  const colaLlena = pendientes.length >= MAX_COLA_PENDIENTE;
  const tienePendientes = pendientes.length > 0;

  const marcasColaSesion = useCallback(
    (persona_id, fecha_ymd) => marcasColaPorDia.get(claveDia(persona_id, fecha_ymd)) || [],
    [marcasColaPorDia],
  );

  const agregarMarcasColaDia = useCallback((entry) => {
    const key = claveDia(entry.persona_id, entry.fecha_ymd);
    setMarcasColaPorDia((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(key) || [])];
      for (const m of entry.marcasAgregadas || []) arr.push(m);
      next.set(key, arr);
      return next;
    });
  }, []);

  const pushPendiente = useCallback((entry) => {
    setItems((prev) => {
      const pend = prev.filter((x) => x.estado === "pendiente");
      if (pend.length >= MAX_COLA_PENDIENTE) return prev;
      const enviados = prev.filter((x) => x.estado === "enviado");
      const nuevo = {
        ...entry,
        estado: "pendiente",
        agregado_en_label:
          entry.agregado_en_label ||
          new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      };
      return [nuevo, ...pend, ...enviados].slice(0, MAX_COLA_PENDIENTE + MAX_HISTORIAL_ENVIADOS);
    });
    agregarMarcasColaDia(entry);
  }, [agregarMarcasColaDia]);

  const marcarEnviado = useCallback((id, datosEnvio) => {
    setItems((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              ...datosEnvio,
              estado: "enviado",
              guardado_en_label:
                datosEnvio.guardado_en_label ||
                new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
            }
          : x,
      ),
    );
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
      if (arr.length === 0) next.delete(key);
      else next.set(key, arr);
      return next;
    });
  }, []);

  const pendientesEnOrdenEnvio = useCallback(
    () => [...pendientes].reverse(),
    [pendientes],
  );

  return {
    colaItems: items,
    pendientes,
    pendientesCount: pendientes.length,
    colaLlena,
    tienePendientes,
    pushPendiente,
    marcarEnviado,
    marcasColaSesion,
    quitarMarcasColaEntrada,
    removeById,
    pendientesEnOrdenEnvio,
  };
};

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { callListarArticulosIngresoAgente } from "../../services/callables.js";

function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/** @type {React.Context<{ loading: boolean, articuloIds: Set<string>, puedeSolicitarArticulo: (id: string) => boolean, recargar: () => Promise<void> }>} */
const ArticulosIngresoContext = createContext({
  loading: true,
  articuloIds: new Set(),
  puedeSolicitarArticulo: () => false,
  recargar: async () => {},
});

/**
 * Artículos Patrón B (ingreso agente) elegibles hoy — misma regla que {@link listarArticulosIngresoAgente}.
 */
export function ArticulosIngresoProvider({ personaId, children }) {
  const [loading, setLoading] = useState(true);
  const [articuloIds, setArticuloIds] = useState(() => new Set());

  const recargar = useCallback(async () => {
    const pid = String(personaId || "").trim();
    if (!/^per_/i.test(pid)) {
      setArticuloIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: ymdHoyBa() });
      const list = res?.data?.articulos || [];
      setArticuloIds(new Set(list.map((a) => String(a.articulo_id || "").trim()).filter(Boolean)));
    } catch {
      setArticuloIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const puedeSolicitarArticulo = useCallback((articuloId) => {
    const id = String(articuloId || "").trim();
    return id.length > 0 && articuloIds.has(id);
  }, [articuloIds]);

  const value = useMemo(
    () => ({ loading, articuloIds, puedeSolicitarArticulo, recargar }),
    [loading, articuloIds, puedeSolicitarArticulo, recargar],
  );

  return <ArticulosIngresoContext.Provider value={value}>{children}</ArticulosIngresoContext.Provider>;
}

export function useArticulosIngresoMenu() {
  return useContext(ArticulosIngresoContext);
}

/**
 * @param {typeof import("../../constants/modulosEstado.js").MODULOS_PORTAL} modulos
 * @param {(articuloId: string) => boolean} puedeSolicitarArticulo
 */
export function filtrarModulosPorArticulosIngreso(modulos, puedeSolicitarArticulo) {
  return modulos.filter((m) => {
    if (m.ticketeraSiempreVisible === true) return true;
    if (m.bandejaJefeMenu === true) return true;
    if (m.bandejaRrhhMenu === true) return true;
    const ids = m.articulosIngresoIds;
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.some((id) => puedeSolicitarArticulo(id));
    }
    const artId = m.articuloIngresoId;
    if (!artId) return true;
    return puedeSolicitarArticulo(artId);
  });
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { callListarArticulosIngresoAgente } from "../../services/callables.js";
import { filaArticuloIngresoDesdeCallable } from "./ticketeraRouteUtils.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

const ArticulosIngresoContext = createContext(null);

function mapDesdeListado(list) {
  const map = new Map();
  for (const raw of list) {
    const row = filaArticuloIngresoDesdeCallable(raw);
    if (row) map.set(row.articulo_id, row);
  }
  return map;
}

export function ArticulosIngresoProvider({ personaId, children }) {
  const [loading, setLoading] = useState(true);
  const [articulosMap, setArticulosMap] = useState(() => new Map());

  const recargarCatalogo = useCallback(
    async (fechaDesde) => {
      const pid = String(personaId || "").trim();
      if (!/^per_/i.test(pid)) {
        setArticulosMap(new Map());
        setLoading(false);
        return;
      }
      const fecha = String(fechaDesde || "").trim().slice(0, 10);
      const fechaRef = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : ymdHoyBa();
      setLoading(true);
      try {
        const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaRef });
        const list = res?.data?.articulos || [];
        setArticulosMap(mapDesdeListado(Array.isArray(list) ? list : []));
      } catch {
        setArticulosMap(new Map());
      } finally {
        setLoading(false);
      }
    },
    [personaId],
  );

  useEffect(() => {
    recargarCatalogo();
  }, [recargarCatalogo]);

  const articuloIds = useMemo(() => new Set(articulosMap.keys()), [articulosMap]);

  const puedeSolicitarArticulo = useCallback(
    (articuloId) => {
      const id = String(articuloId || "").trim();
      return id.length > 0 && articulosMap.has(id);
    },
    [articulosMap],
  );

  const obtenerDatosArticuloElegible = useCallback(
    (articuloId) => {
      const id = String(articuloId || "").trim();
      return articulosMap.get(id) || null;
    },
    [articulosMap],
  );

  const articulosElegibles = useMemo(() => [...articulosMap.values()], [articulosMap]);

  const value = useMemo(
    () => ({
      loading,
      articuloIds,
      articulosMap,
      articulosElegibles,
      puedeSolicitarArticulo,
      obtenerDatosArticuloElegible,
      recargar: recargarCatalogo,
      recargarCatalogo,
    }),
    [
      loading,
      articuloIds,
      articulosMap,
      articulosElegibles,
      puedeSolicitarArticulo,
      obtenerDatosArticuloElegible,
      recargarCatalogo,
    ],
  );

  return <ArticulosIngresoContext.Provider value={value}>{children}</ArticulosIngresoContext.Provider>;
}

export function useArticulosIngresoMenu() {
  const ctx = useContext(ArticulosIngresoContext);
  if (!ctx) {
    throw new Error("useArticulosIngresoMenu debe usarse dentro de ArticulosIngresoProvider");
  }
  return ctx;
}

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

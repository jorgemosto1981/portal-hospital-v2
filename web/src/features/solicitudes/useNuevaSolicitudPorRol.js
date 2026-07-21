import { useCallback, useEffect, useState } from "react";

import { callListarArticulosIngresoPorRol } from "../../services/callables.js";
import { mapArticuloNuevaSolicitud } from "./nuevaSolicitudPorRol.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

/**
 * @param {{
 *   rolId: string,
 *   titularPersonaId: string,
 *   enabled?: boolean,
 * }} opts
 */
export function useNuevaSolicitudPorRol({ rolId, titularPersonaId, enabled = true }) {
  const [cargando, setCargando] = useState(false);
  const [articulos, setArticulos] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    const rol = String(rolId || "").trim();
    const titular = String(titularPersonaId || "").trim();
    if (!enabled || !rol || !/^per_/i.test(titular)) {
      setArticulos([]);
      setError("");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await callListarArticulosIngresoPorRol({
        rol_id: rol,
        titular_persona_id: titular,
        fecha_desde: ymdHoyBa(),
      });
      const list = res?.data?.articulos || [];
      setArticulos(
        (Array.isArray(list) ? list : []).map(mapArticuloNuevaSolicitud).filter(Boolean),
      );
    } catch (e) {
      setArticulos([]);
      setError(e?.message || "No se pudo cargar el catálogo de artículos.");
    } finally {
      setCargando(false);
    }
  }, [rolId, titularPersonaId, enabled]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { cargando, articulos, error, recargar };
}

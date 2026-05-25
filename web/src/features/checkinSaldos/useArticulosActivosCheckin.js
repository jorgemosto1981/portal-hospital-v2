import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { listarColeccion } from "../../services/configuracionCatalogosService.js";

/**
 * @typedef {{ id: string, codigo: string, nombre: string, activo: boolean }} ArticuloCheckinRow
 */

export function useArticulosActivosCheckin() {
  const [articulos, setArticulos] = useState(/** @type {ArticuloCheckinRow[]} */ ([]));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listarColeccion("cfg_articulos");
      const vigentes = items
        .filter((a) => a && typeof a === "object" && a.activo !== false)
        .map((a) => ({
          id: String(a.id || "").trim(),
          codigo: String(a.codigo || a.id || "").trim(),
          nombre: String(a.nombre || "").trim(),
          activo: a.activo !== false,
        }))
        .filter((a) => /^art_/i.test(a.id))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
      setArticulos(vigentes);
    } catch (e) {
      toast.error(e?.message || "No se pudo cargar artículos vigentes.");
      setArticulos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { articulos, loadingArticulos: loading, reloadArticulos: reload };
}

import { useCallback, useEffect, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { mapCatalogoRowToOption } from "../../../utils/articulos/mapCatalogoRowToOption.js";

/** Catálogos del bloque plazos documentales (`articulo.schema.js`). */
export const PLAZOS_CATALOG_SPECS = /** @type {const} */ ([
  { key: "momentoEntrega", collectionName: "cfg_momento_entrega_documentacion" },
  { key: "tipoComputoPlazo", collectionName: "cfg_tipo_computo_plazo" },
  { key: "accionVencimiento", collectionName: "cfg_accion_vencimiento" },
]);

function initialAll() {
  return Object.fromEntries(
    PLAZOS_CATALOG_SPECS.map((s) => [s.key, { status: "loading", options: [], error: null }]),
  );
}

/**
 * @returns {{ catalogos: Record<string, { status: string, options: { value: string, label: string }[], error: string | null }>, recargarCatalogos: () => Promise<void> }}
 */
export function useArticuloPlazosCatalogos() {
  const [catalogos, setCatalogos] = useState(initialAll);

  const recargar = useCallback(async () => {
    setCatalogos(initialAll());

    const settled = await Promise.allSettled(
      PLAZOS_CATALOG_SPECS.map(async (s) => {
        const rows = await listarColeccion(s.collectionName);
        const options = (Array.isArray(rows) ? rows : [])
          .map((r) => mapCatalogoRowToOption(r))
          .filter(Boolean);
        return { key: s.key, options };
      }),
    );

    setCatalogos((prev) => {
      const next = { ...prev };
      settled.forEach((result, i) => {
        const key = PLAZOS_CATALOG_SPECS[i].key;
        if (result.status === "fulfilled") {
          next[key] = { status: "ok", options: result.value.options, error: null };
        } else {
          const err =
            result.reason && typeof result.reason.message === "string"
              ? result.reason.message
              : "Error al cargar";
          next[key] = { status: "error", options: [], error: err };
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { catalogos, recargarCatalogos: recargar };
}

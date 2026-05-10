import { useCallback, useEffect, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { mapCatalogoRowToOption } from "../../../utils/articulos/mapCatalogoRowToOption.js";

const CADENCIA_CATALOG_SPECS = /** @type {const} */ ([
  { key: "unidadIntervalo", collectionName: "cfg_unidad_intervalo_tiempo" },
]);

function initialAll() {
  return Object.fromEntries(
    CADENCIA_CATALOG_SPECS.map((s) => [s.key, { status: "loading", options: [], error: null }]),
  );
}

/**
 * Catálogos para `reglas_cadencia` (unidades de intervalo).
 */
export function useArticuloCadenciaCatalogos() {
  const [catalogos, setCatalogos] = useState(initialAll);

  const recargar = useCallback(async () => {
    setCatalogos(initialAll());
    const settled = await Promise.allSettled(
      CADENCIA_CATALOG_SPECS.map(async (s) => {
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
        const key = CADENCIA_CATALOG_SPECS[i].key;
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

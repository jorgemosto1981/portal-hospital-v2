import { useCallback, useEffect, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { mapCatalogoRowToOption } from "../../../utils/articulos/mapCatalogoRowToOption.js";

/** Catálogos del bloque Workflow en `cfg_articulos`. */
export const WORKFLOW_CATALOG_SPECS = /** @type {const} */ ([
  { key: "origenAlta", collectionName: "cfg_origen_alta_solicitud" },
  { key: "reglaSplit", collectionName: "cfg_regla_split_remanente" },
  { key: "prioridadNormativa", collectionName: "cfg_prioridad_normativa" },
  { key: "politicaSuperposicion", collectionName: "cfg_politica_superposicion" },
  { key: "pasoWorkflow", collectionName: "cfg_paso_workflow_articulo" },
]);

function initialAll() {
  return Object.fromEntries(
    WORKFLOW_CATALOG_SPECS.map((s) => [s.key, { status: "loading", options: [], error: null }]),
  );
}

/**
 * @returns {{ catalogos: Record<string, { status: string, options: { value: string, label: string }[], error: string | null }>, recargarCatalogos: () => Promise<void> }}
 */
export function useArticuloWorkflowCatalogos() {
  const [catalogos, setCatalogos] = useState(initialAll);

  const recargar = useCallback(async () => {
    setCatalogos(initialAll());
    const settled = await Promise.allSettled(
      WORKFLOW_CATALOG_SPECS.map(async (s) => {
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
        const key = WORKFLOW_CATALOG_SPECS[i].key;
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

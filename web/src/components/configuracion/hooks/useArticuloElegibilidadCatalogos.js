import { useCallback, useEffect, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { mapCatalogoRowToOption } from "../../../utils/articulos/mapCatalogoRowToOption.js";

/** Orden y colección alineadas a `filtros_elegibilidad` en `articulo.schema.js`. */
export const ELEGIBILIDAD_CATALOG_SPECS = /** @type {const} */ ([
  { key: "escalafon", collectionName: "cfg_escalafon" },
  { key: "agrupamiento", collectionName: "cfg_agrupamiento" },
  { key: "cargoFuncional", collectionName: "cfg_cargo_funcional" },
  { key: "tipoVinculo", collectionName: "cfg_tipo_vinculo_laboral" },
  { key: "efector", collectionName: "cfg_efectores" },
  { key: "grupoTrabajo", collectionName: "grupos_de_trabajo" },
  { key: "genero", collectionName: "cfg_sexo_genero" },
]);

function initialAll() {
  return Object.fromEntries(
    ELEGIBILIDAD_CATALOG_SPECS.map((s) => [s.key, { status: "loading", options: [], error: null }]),
  );
}

/**
 * Catálogos para filtros de elegibilidad (listados RRHH).
 * @returns {{ catalogos: Record<string, { status: string, options: { value: string, label: string }[], error: string | null }>, recargarCatalogos: () => Promise<void> }}
 */
export function useArticuloElegibilidadCatalogos() {
  const [catalogos, setCatalogos] = useState(initialAll);

  const recargar = useCallback(async () => {
    setCatalogos(initialAll());

    const settled = await Promise.allSettled(
      ELEGIBILIDAD_CATALOG_SPECS.map(async (s) => {
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
        const key = ELEGIBILIDAD_CATALOG_SPECS[i].key;
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

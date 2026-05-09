import { useCallback, useEffect, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { mapCatalogoRowToOption } from "../../../utils/articulos/mapCatalogoRowToOption.js";

const SPECS = [
  { key: "tipoArticulo", collectionName: "cfg_tipo_articulo" },
  { key: "unidadMedida", collectionName: "cfg_unidad_medida_articulo" },
  /** `norma_principal_tipo_id` en schema; catálogo operativo vía tipo de acto designación hasta colección dedicada. */
  { key: "normaPrincipalTipo", collectionName: "cfg_tipo_acto_designacion" },
];

function initialCatalogState() {
  return Object.fromEntries(
    SPECS.map((s) => [s.key, { status: "loading", options: [], error: null }]),
  );
}

/**
 * Carga catálogos del formulario General con `Promise.allSettled` (una falla no bloquea el resto).
 */
export function useArticuloGeneralCatalogos() {
  const [catalogos, setCatalogos] = useState(initialCatalogState);

  const recargar = useCallback(async () => {
    setCatalogos(initialCatalogState());

    const settled = await Promise.allSettled(
      SPECS.map(async (s) => {
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
        const key = SPECS[i].key;
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

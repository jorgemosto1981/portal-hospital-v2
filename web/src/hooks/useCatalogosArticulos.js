import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import runtimeFlags from "../../../shared/runtimeFlags.json";
import { authV2 } from "../services/firebase.js";
import { listarColeccion } from "../services/configuracionCatalogosService.js";

/**
 * Colecciones por defecto para selects del panel de versión de artículos (Bloque 4 y Bloque 7).
 * Referencia estable para no disparar el efecto del hook en cada render.
 */
export const DEFAULT_CATALOGOS_ARTICULOS_FORM = Object.freeze([
  "cfg_estado_version_articulo",
  "cfg_justifica_sueldo",
  "cfg_regla_computo_dias",
  "cfg_ambito_consumo",
  "cfg_regla_computo_horas",
  "cfg_reinicio_ciclo_cuota",
  "cfg_accion_saldo",
  "cfg_origen_saldo",
  "cfg_tipo_caducidad",
  "cfg_operador_comparacion",
  "cfg_accion_incumplimiento_documental",
  "cfg_nivel_ocupacion_dia",
]);

/** @type {Map<string, { rows: object[], fetchedAt: number }>} */
const cachePorColeccion = new Map();

const openAccessTemp = runtimeFlags.OPEN_ACCESS_TEMP === true;

function filasActivasOrdenadas(rows) {
  return rows
    .filter((row) => row && typeof row === "object" && row.activo !== false)
    .sort((a, b) => {
      const oa = typeof a.orden === "number" ? a.orden : Number(a.orden) || 0;
      const ob = typeof b.orden === "number" ? b.orden : Number(b.orden) || 0;
      return oa - ob;
    });
}

/**
 * Carga bajo demanda por nombre de colección, con caché en memoria entre pestañas y remounts.
 * Lectura: callable `listarColeccion` (misma vía que configuración RRHH; Admin SDK en el servidor)
 * + filtro `activo` y orden por `orden` en cliente.
 *
 * @param {readonly string[]} colecciones - nombres de colección `cfg_*`
 * @returns {{
 *   catalogos: Record<string, object[]>,
 *   loading: boolean,
 *   error: Error | null,
 *   getOptions: (colName: string) => { value: string, label: string, descripcion?: string }[],
 *   refresh: () => Promise<void>,
 * }}
 */
export function useCatalogosArticulos(colecciones = DEFAULT_CATALOGOS_ARTICULOS_FORM) {
  const [catalogos, setCatalogos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lista = useMemo(
    () => [...colecciones].filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim()),
    [colecciones],
  );

  const cargar = useCallback(
    async ({ limpiarCache } = { limpiarCache: false }) => {
      if (lista.length === 0) {
        setCatalogos({});
        setLoading(false);
        setError(null);
        return;
      }
      if (limpiarCache) {
        for (const c of lista) {
          cachePorColeccion.delete(c);
        }
      }
      setLoading(true);
      setError(null);
      try {
        if (!openAccessTemp && !authV2.currentUser) {
          setCatalogos({});
          setError(null);
          return;
        }
        const resultados = {};
        await Promise.all(
          lista.map(async (colName) => {
            if (!limpiarCache && cachePorColeccion.has(colName)) {
              resultados[colName] = cachePorColeccion.get(colName).rows;
              return;
            }
            const items = await listarColeccion(colName);
            const rows = filasActivasOrdenadas(Array.isArray(items) ? items : []);
            cachePorColeccion.set(colName, { rows, fetchedAt: Date.now() });
            resultados[colName] = rows;
          }),
        );
        setCatalogos(resultados);
      } catch (err) {
        console.error("[useCatalogosArticulos]", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [lista],
  );

  useEffect(() => {
    if (openAccessTemp) {
      void cargar({ limpiarCache: false });
      return undefined;
    }
    const unsub = onAuthStateChanged(authV2, () => {
      void cargar({ limpiarCache: false });
    });
    return () => unsub();
  }, [cargar]);

  const getOptions = useCallback(
    (colName) => {
      const rows = catalogos[colName] || [];
      return rows.map((item) => ({
        value: item.id,
        label: typeof item.titulo_ui === "string" && item.titulo_ui.trim() ? item.titulo_ui.trim() : item.id,
        descripcion: typeof item.descripcion_ui === "string" ? item.descripcion_ui.trim() : undefined,
      }));
    },
    [catalogos],
  );

  const refresh = useCallback(() => cargar({ limpiarCache: true }), [cargar]);

  return { catalogos, loading, error, getOptions, refresh };
}

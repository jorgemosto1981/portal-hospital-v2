import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import runtimeFlags from "../../../shared/runtimeFlags.json";
import { authV2 } from "../services/firebase.js";
import { listarColeccion } from "../services/configuracionCatalogosService.js";

/**
 * Colecciones por defecto para selects del panel de versión de artículos (Bloque 4 y Bloque 7).
 * Referencia estable para no disparar el efecto del hook en cada render.
 *
 * `grupos_de_trabajo` va diferido: es el catálogo más pesado y solo se usa en elegibilidad.
 */
export const CATALOGOS_ARTICULOS_CORE = Object.freeze([
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
  "cfg_politica_superposicion",
  "cfg_unidad_medida_articulo",
  "cfg_unidad_minima_consumo",
  "cfg_rol",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_tipo_vinculo_laboral",
  "cfg_cargo_funcional",
  "cfg_sexo_genero",
]);

export const CATALOGOS_ARTICULOS_DIFERIDOS = Object.freeze(["grupos_de_trabajo"]);

export const DEFAULT_CATALOGOS_ARTICULOS_FORM = Object.freeze([
  ...CATALOGOS_ARTICULOS_CORE,
  ...CATALOGOS_ARTICULOS_DIFERIDOS,
]);

/** Solo estado de versión (listados / strips). Referencia estable — no pasar arrays literales al hook. */
export const CATALOGOS_ESTADO_VERSION = Object.freeze(["cfg_estado_version_articulo"]);

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
 * Clave estable por contenido (evita bucle infinito si el caller pasa `["cfg_…"]` inline).
 * @param {readonly string[]} colecciones
 */
function coleccionesKey(colecciones) {
  return [...colecciones]
    .filter((c) => typeof c === "string" && c.trim())
    .map((c) => c.trim())
    .join("\0");
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
  const loadGenRef = useRef(0);

  // Importante: clave por *contenido*. Un array literal nuevo cada render no debe recrear `cargar`.
  const listaKey = coleccionesKey(colecciones);
  const lista = useMemo(() => (listaKey ? listaKey.split("\0") : []), [listaKey]);

  const cargar = useCallback(async ({ limpiarCache } = { limpiarCache: false }) => {
    const gen = ++loadGenRef.current;
    const alive = () => loadGenRef.current === gen;

    if (lista.length === 0) {
      if (alive()) {
        setCatalogos({});
        setLoading(false);
        setError(null);
      }
      return;
    }
    if (limpiarCache) {
      for (const c of lista) {
        cachePorColeccion.delete(c);
      }
    }
    if (alive()) {
      setLoading(true);
      setError(null);
    }
    try {
      if (!openAccessTemp && !authV2.currentUser) {
        if (alive()) {
          setCatalogos({});
          setError(null);
        }
        return;
      }
      /** @type {Record<string, object[]>} */
      const resultados = {};
      for (const colName of lista) {
        if (!limpiarCache && cachePorColeccion.has(colName)) {
          resultados[colName] = cachePorColeccion.get(colName).rows;
        }
      }
      // UI usable de inmediato si hay caché; sin setState por cada colección (evita freezar el form).
      if (Object.keys(resultados).length > 0 && alive()) {
        setCatalogos({ ...resultados });
        setLoading(false);
      }

      const pendientes = lista.filter((c) => !Object.prototype.hasOwnProperty.call(resultados, c));
      if (pendientes.length === 0) {
        if (alive()) setCatalogos({ ...resultados });
      } else {
        const CONCURRENCY = 3;
        let cursor = 0;
        async function worker() {
          while (alive() && cursor < pendientes.length) {
            const i = cursor;
            cursor += 1;
            const colName = pendientes[i];
            const items = await listarColeccion(colName);
            if (!alive()) return;
            const rows = filasActivasOrdenadas(Array.isArray(items) ? items : []);
            cachePorColeccion.set(colName, { rows, fetchedAt: Date.now() });
            resultados[colName] = rows;
          }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pendientes.length) }, () => worker()));
        if (alive()) setCatalogos({ ...resultados });
      }
    } catch (err) {
      if (!alive()) return;
      console.error("[useCatalogosArticulos]", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (alive()) setLoading(false);
    }
  }, [lista]);

  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    if (openAccessTemp) {
      void cargarRef.current({ limpiarCache: false });
      return () => {
        loadGenRef.current += 1;
      };
    }
    // Suscripción anclada a listaKey (contenido). Callback via ref → no re-subscribe por identidad de cargar.
    const unsub = onAuthStateChanged(authV2, () => {
      void cargarRef.current({ limpiarCache: false });
    });
    return () => {
      loadGenRef.current += 1;
      unsub();
    };
  }, [listaKey]);

  const getOptions = useCallback(
    (colName) => {
      const rows = catalogos[colName] || [];
      return rows.map((item) => ({
        value: item.id,
        label:
          (typeof item.titulo_ui === "string" && item.titulo_ui.trim()) ||
          (typeof item.nombre === "string" && item.nombre.trim()) ||
          (typeof item.codigo_interno === "string" && item.codigo_interno.trim()) ||
          item.id,
        descripcion: typeof item.descripcion_ui === "string" ? item.descripcion_ui.trim() : undefined,
      }));
    },
    [catalogos],
  );

  const refresh = useCallback(() => cargar({ limpiarCache: true }), [cargar]);

  return { catalogos, loading, error, getOptions, refresh };
}

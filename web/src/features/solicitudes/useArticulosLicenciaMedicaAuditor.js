import { useEffect, useMemo, useState } from "react";

import { callListarArticulosLicenciaMedicaAuditor } from "../../services/callables.js";

/**
 * @param {{ articuloId?: string, versionId?: string } | null} valorInicial
 */
export function useArticulosLicenciaMedicaAuditor(valorInicial) {
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCargando(true);
      setError("");
      try {
        const res = await callListarArticulosLicenciaMedicaAuditor();
        const list = Array.isArray(res?.data?.articulos) ? res.data.articulos : [];
        if (!cancelled) setArticulos(list);
      } catch (e) {
        if (!cancelled) setError(e?.message || "No se pudo cargar artículos médicos.");
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const opciones = useMemo(
    () =>
      articulos.map((a) => ({
        articulo_id: String(a.articulo_id || ""),
        version_id_aplicada: String(a.version_id_aplicada || ""),
        key: `${a.articulo_id}|${a.version_id_aplicada}`,
        label:
          String(a.articulo_label || "").trim() ||
          [a.codigo, a.nombre].filter(Boolean).join(" — ") ||
          String(a.articulo_id || ""),
        es_corta_anual: a.es_corta_anual === true,
        es_larga_episodio: a.es_larga_episodio === true,
        codigo_grilla: String(a.codigo_grilla || "").trim(),
      })),
    [articulos],
  );

  const valorDefault = useMemo(() => {
    if (!opciones.length) return null;
    const artInicial = String(valorInicial?.articuloId || "").trim();
    const verInicial = String(valorInicial?.versionId || "").trim();
    if (/^art_/i.test(artInicial) && /^ver_/i.test(verInicial)) {
      const hit = opciones.find(
        (o) => o.articulo_id === artInicial && o.version_id_aplicada === verInicial,
      );
      if (hit) return hit;
    }
    return opciones.find((o) => o.es_corta_anual) || opciones[0];
  }, [opciones, valorInicial?.articuloId, valorInicial?.versionId]);

  return { opciones, cargando, error, valorDefault };
}

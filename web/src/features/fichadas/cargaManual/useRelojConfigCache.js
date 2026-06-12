import { useEffect, useMemo, useRef, useState } from "react";

import { listarColeccion } from "../../../services/configuracionCatalogosService.js";

const DEFAULT_POLITICA = {
  umbral_duplicado_minutos: 2,
  duplicados: "EXCLUIR_SEGUNDA",
};

/**
 * §15.1B — una lectura de catálogo al montar; política por reloj en memoria (sin re-fetch por agente).
 *
 * @param {string} relojId
 */
export function useRelojConfigCache(relojId) {
  const [relojes, setRelojes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const items = await listarColeccion("cfg_reloj_biometrico");
        if (alive) setRelojes(Array.isArray(items) ? items.filter((r) => r.activo !== false) : []);
      } catch (e) {
        if (alive) setError(e?.message || "No se pudo cargar cfg_reloj_biometrico.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reloj = useMemo(
    () => relojes.find((r) => String(r.id) === String(relojId || "")) || null,
    [relojes, relojId],
  );

  const politica = useMemo(() => {
    const p = reloj?.politica_validacion;
    if (!p || typeof p !== "object") return { ...DEFAULT_POLITICA };
    return {
      umbral_duplicado_minutos:
        p.umbral_duplicado_minutos != null ? Number(p.umbral_duplicado_minutos) : DEFAULT_POLITICA.umbral_duplicado_minutos,
      duplicados: p.duplicados || DEFAULT_POLITICA.duplicados,
    };
  }, [reloj]);

  const grupoTrabajoId = String(reloj?.grupo_trabajo_id || reloj?.grupo_id || "").trim();
  const esRelojUniversal = Boolean(reloj) && !/^gdt_/i.test(grupoTrabajoId);

  return { relojes, reloj, politica, grupoTrabajoId, esRelojUniversal, loading, error };
}

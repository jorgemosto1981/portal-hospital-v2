import { useCallback, useEffect, useMemo, useState } from "react";

import { callListarCfgRelojBiometrico } from "../../../services/callables.js";
import { listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { laboralCallableErrorMessage } from "../../../pages/datos-laborales/callableErrorMessage.js";

const DEFAULT_POLITICA = {
  umbral_duplicado_minutos: 2,
  duplicados: "EXCLUIR_SEGUNDA",
};

/**
 * §15.1B — catálogo de relojes para carga manual (callable fichadas + fallback listarColeccion).
 *
 * @param {string} relojId
 */
export function useRelojConfigCache(relojId) {
  const [relojes, setRelojes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let items = [];
      try {
        const res = await callListarCfgRelojBiometrico({ incluir_inactivos: false });
        items = Array.isArray(res.data?.items) ? res.data.items : [];
      } catch (e1) {
        const itemsLegacy = await listarColeccion("cfg_reloj_biometrico");
        items = Array.isArray(itemsLegacy) ? itemsLegacy : [];
        if (!items.length) {
          throw e1;
        }
      }
      setRelojes(
        items
          .filter((r) => r && r.activo !== false)
          .map((r) => ({
            ...r,
            id: String(r.id || r.reloj_id || "").trim(),
            nombre: String(r.nombre || r.id || "").trim(),
          }))
          .filter((r) => /^rel_/i.test(r.id)),
      );
    } catch (e) {
      setRelojes([]);
      setError(laboralCallableErrorMessage(e, "No se pudo cargar el catálogo de relojes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reloj = useMemo(
    () => relojes.find((r) => String(r.id) === String(relojId || "")) || null,
    [relojes, relojId],
  );

  const politica = useMemo(() => {
    const p = reloj?.politica_validacion;
    if (!p || typeof p !== "object") return { ...DEFAULT_POLITICA };
    return {
      umbral_duplicado_minutos:
        p.umbral_duplicado_minutos != null
          ? Number(p.umbral_duplicado_minutos)
          : DEFAULT_POLITICA.umbral_duplicado_minutos,
      duplicados: p.duplicados || DEFAULT_POLITICA.duplicados,
    };
  }, [reloj]);

  const grupoTrabajoId = String(reloj?.grupo_trabajo_id || reloj?.grupo_id || "").trim();
  const esRelojUniversal = Boolean(reloj) && !/^gdt_/i.test(grupoTrabajoId);

  return {
    relojes,
    reloj,
    politica,
    grupoTrabajoId,
    esRelojUniversal,
    loading,
    error,
    recargar: cargar,
  };
}

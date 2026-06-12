import { useCallback, useEffect, useMemo, useState } from "react";

import { listarColeccion } from "../../services/configuracionCatalogosService.js";

/**
 * Una lectura de catálogo reloj + enrolamiento al montar (§15.1B).
 */
export function useRelojBiometricoCatalogo() {
  const [relojes, setRelojes] = useState([]);
  const [enrolamientos, setEnrolamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [relItems, rpeItems] = await Promise.all([
        listarColeccion("cfg_reloj_biometrico"),
        listarColeccion("reloj_persona_enrolamiento"),
      ]);
      setRelojes(Array.isArray(relItems) ? relItems.filter((r) => r.activo !== false) : []);
      setEnrolamientos(Array.isArray(rpeItems) ? rpeItems.filter((r) => r.activo !== false) : []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar catálogo de relojes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const enrolPorReloj = useMemo(() => {
    /** @type {Map<string, Map<string, { persona_id: string, persona_label?: string }>>} */
    const porReloj = new Map();
    for (const row of enrolamientos) {
      const rel = String(row.reloj_id || "").trim();
      const tarjeta = String(row.numero_tarjeta || "").trim();
      const pid = String(row.persona_id || "").trim();
      if (!rel || !tarjeta || !pid) continue;
      if (!porReloj.has(rel)) porReloj.set(rel, new Map());
      porReloj.get(rel).set(tarjeta, { persona_id: pid });
    }
    return porReloj;
  }, [enrolamientos]);

  return {
    relojes,
    enrolamientos,
    enrolPorReloj,
    loading,
    error,
    recargar: cargar,
  };
}

/**
 * @param {Map<string, { persona_id: string }>} tarjetasMap
 * @param {Array<{ id: string, nombre?: string, apellido?: string, dni?: string }>} personas
 */
export function enriquecerEnrolamientoConPersonas(tarjetasMap, personas) {
  /** @type {Record<string, { persona_id: string, persona_label: string }>} */
  const out = {};
  const personaById = new Map();
  for (const p of personas) {
    const id = String(p.id || "").trim();
    if (!id) continue;
    const label = [p.apellido, p.nombre].filter(Boolean).join(", ") || p.dni || id;
    personaById.set(id, label);
  }
  for (const [tarjeta, row] of tarjetasMap.entries()) {
    const pid = row.persona_id;
    out[tarjeta] = {
      persona_id: pid,
      persona_label: personaById.get(pid) || pid,
    };
  }
  return out;
}

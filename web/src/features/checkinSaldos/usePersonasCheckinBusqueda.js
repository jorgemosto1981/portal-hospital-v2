import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callBuscarPersonasCheckinRrhh } from "../../services/callables.js";

function personaEsActiva(p) {
  if (!p || typeof p !== "object") return false;
  if (p.activo === false) return false;
  const est = String(p.estado || "").trim().toUpperCase();
  if (est === "INACTIVO" || est === "BAJA") return false;
  return true;
}

function toOption(p) {
  const nombre = `${String(p?.nombre || "").trim()} ${String(p?.apellido || "").trim()}`.trim();
  const dni = String(p?.dni || "").trim();
  const label = nombre ? `${nombre} · DNI ${dni || "—"}` : `DNI ${dni || "—"}`;
  const id = String(p.id || "");
  return { value: id, label, secondary: id, search: `${nombre} ${dni} ${id}`.toLowerCase() };
}

/**
 * Búsqueda server-side de personas activas (check-in / guía alta).
 */
export function usePersonasCheckinBusqueda() {
  const [personas, setPersonas] = useState([]);
  const [loadPersonas, setLoadPersonas] = useState(false);
  const [personaQuery, setPersonaQuery] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);

  const fetchPersonas = useCallback(async (query) => {
    setLoadPersonas(true);
    try {
      const res = await callBuscarPersonasCheckinRrhh({
        query: String(query || "").trim(),
        limit: 40,
      });
      const items = (res?.data?.items || []).filter(personaEsActiva);
      setPersonas(items);
    } catch (e) {
      setPersonas([]);
      toast.error(e?.message || "No se pudo buscar personas.");
    } finally {
      setLoadPersonas(false);
    }
  }, []);

  useEffect(() => {
    if (!personaOpen) return;
    const t = setTimeout(() => {
      void fetchPersonas(personaQuery);
    }, 280);
    return () => clearTimeout(t);
  }, [personaOpen, personaQuery, fetchPersonas]);

  const personaOptions = useMemo(() => personas.map(toOption), [personas]);

  const personaOptionsFiltradas = personaOptions;

  return {
    personas,
    loadPersonas,
    personaQuery,
    setPersonaQuery,
    personaOpen,
    setPersonaOpen,
    personaOptions,
    personaOptionsFiltradas,
    refetchPersonas: fetchPersonas,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { usePersonasCheckinBusqueda } from "./usePersonasCheckinBusqueda.js";

/**
 * Combobox de agente, sincronía con `?persona_id=` y cambio de selección.
 * @param {{ onPersonaWillChange: () => void }} opts
 */
export function useCheckinPersonaSeleccion({ onPersonaWillChange }) {
  const [searchParams] = useSearchParams();
  const [personaId, setPersonaId] = useState("");
  const personaWrapRef = useRef(null);
  const personaIdAnteriorRef = useRef("");
  const lastUrlPersonaRef = useRef("");

  const busqueda = usePersonasCheckinBusqueda();

  const setPersonaIdCheckin = useCallback(
    (nextId) => {
      const next = String(nextId || "").trim();
      const prev = personaIdAnteriorRef.current;
      if (prev && next !== prev) onPersonaWillChange();
      if (!next) {
        onPersonaWillChange();
        personaIdAnteriorRef.current = "";
        setPersonaId("");
        return;
      }
      personaIdAnteriorRef.current = next;
      setPersonaId(next);
    },
    [onPersonaWillChange],
  );

  const personaSeleccionadaLabel = useMemo(() => {
    const hit = busqueda.personaOptions.find((o) => o.value === personaId);
    return hit ? hit.label : personaId ? String(personaId) : "";
  }, [personaId, busqueda.personaOptions]);

  const clearBusquedaUi = useCallback(() => {
    busqueda.setPersonaOpen(false);
    busqueda.setPersonaQuery("");
  }, [busqueda.setPersonaOpen, busqueda.setPersonaQuery]);

  useEffect(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    if (!/^per_/i.test(fromUrl)) return;
    const current = String(personaId || "").trim();
    const prevUrl = lastUrlPersonaRef.current;
    if (prevUrl && current && current !== prevUrl && fromUrl === prevUrl) return;
    if (current === fromUrl) {
      lastUrlPersonaRef.current = fromUrl;
      return;
    }
    setPersonaIdCheckin(fromUrl);
    lastUrlPersonaRef.current = fromUrl;
    void busqueda.refetchPersonas(fromUrl);
  }, [searchParams, personaId, setPersonaIdCheckin, busqueda.refetchPersonas]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (/^per_/i.test(per)) void busqueda.refetchPersonas(per);
  }, [personaId, busqueda.refetchPersonas]);

  useEffect(() => {
    if (!busqueda.personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current?.contains(ev.target)) busqueda.setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [busqueda.personaOpen, busqueda.setPersonaOpen]);

  return {
    personaWrapRef,
    personaId,
    setPersonaIdCheckin,
    personaSeleccionadaLabel,
    clearBusquedaUi,
    loadPersonas: busqueda.loadPersonas,
    personaOpen: busqueda.personaOpen,
    setPersonaOpen: busqueda.setPersonaOpen,
    personaQuery: busqueda.personaQuery,
    setPersonaQuery: busqueda.setPersonaQuery,
    personaOptionsFiltradas: busqueda.personaOptionsFiltradas,
  };
}

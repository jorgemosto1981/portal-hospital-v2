import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { usePersonasCheckinBusqueda } from "../checkinSaldos/usePersonasCheckinBusqueda.js";
import { useAltaOnboardingTracker } from "./useAltaOnboardingTracker.js";

export function useAltaOnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const personaWrapRef = useRef(null);

  const [personaId, setPersonaId] = useState(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    return /^per_/i.test(fromUrl) ? fromUrl : "";
  });
  const urlAppliedRef = useRef(false);

  const {
    loadPersonas,
    personaQuery,
    setPersonaQuery,
    personaOpen,
    setPersonaOpen,
    personaOptions,
    personaOptionsFiltradas,
    refetchPersonas,
  } = usePersonasCheckinBusqueda();

  const tracker = useAltaOnboardingTracker(personaId);

  useEffect(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    if (!/^per_/i.test(fromUrl)) return;
    if (urlAppliedRef.current && personaId === fromUrl) return;
    urlAppliedRef.current = true;
    if (personaId !== fromUrl) setPersonaId(fromUrl);
    void refetchPersonas(fromUrl);
  }, [searchParams, personaId, refetchPersonas]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (/^per_/i.test(per)) void refetchPersonas(per);
  }, [personaId, refetchPersonas]);

  const setPersonaIdOnboarding = useCallback(
    (nextId) => {
      const next = String(nextId || "").trim();
      setPersonaId(next);
      setPersonaOpen(false);
      setPersonaQuery("");
      const params = new URLSearchParams(searchParams);
      if (/^per_/i.test(next)) {
        params.set("persona_id", next);
      } else {
        params.delete("persona_id");
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, setPersonaOpen, setPersonaQuery],
  );

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current?.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen, setPersonaOpen]);

  const personaSeleccionadaLabel = useMemo(() => {
    const hit = personaOptions.find((o) => o.value === personaId);
    return hit ? hit.label : personaId ? String(personaId) : "";
  }, [personaId, personaOptions]);

  return {
    personaWrapRef,
    loadPersonas,
    personaOpen,
    setPersonaOpen,
    personaQuery,
    setPersonaQuery,
    personaId,
    setPersonaId: setPersonaIdOnboarding,
    personaSeleccionadaLabel,
    personaOptionsFiltradas,
    tracker,
  };
}

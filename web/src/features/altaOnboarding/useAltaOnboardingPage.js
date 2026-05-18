import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { callListarColeccionPublicaTemporal } from "../../services/callables.js";
import { useAltaOnboardingTracker } from "./useAltaOnboardingTracker.js";

function personaEsActiva(p) {
  if (!p || typeof p !== "object") return false;
  if (p.activo === false) return false;
  const est = String(p.estado || "").trim().toUpperCase();
  if (est === "INACTIVO" || est === "BAJA") return false;
  return true;
}

export function useAltaOnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const personaWrapRef = useRef(null);

  const [personas, setPersonas] = useState([]);
  const [loadPersonas, setLoadPersonas] = useState(true);
  const [personaId, setPersonaId] = useState(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    return /^per_/i.test(fromUrl) ? fromUrl : "";
  });
  const [personaQuery, setPersonaQuery] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const urlAppliedRef = useRef(false);

  const tracker = useAltaOnboardingTracker(personaId);

  useEffect(() => {
    let mounted = true;
    setLoadPersonas(true);
    callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 400 })
      .then((resp) => {
        if (!mounted) return;
        setPersonas((resp?.data?.items || []).filter(personaEsActiva));
      })
      .catch((e) => toast.error(e?.message || "No se pudo cargar personas."))
      .finally(() => {
        if (mounted) setLoadPersonas(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    if (!/^per_/i.test(fromUrl)) return;
    if (loadPersonas) return;
    if (urlAppliedRef.current && personaId === fromUrl) return;
    urlAppliedRef.current = true;
    if (personaId !== fromUrl) setPersonaId(fromUrl);
  }, [searchParams, loadPersonas, personaId]);

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
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current?.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen]);

  const personaOptions = useMemo(
    () =>
      personas.map((p) => {
        const nombre = `${String(p?.nombre || "").trim()} ${String(p?.apellido || "").trim()}`.trim();
        const dni = String(p?.dni || "").trim();
        const label = nombre ? `${nombre} · DNI ${dni || "—"}` : `DNI ${dni || "—"}`;
        const id = String(p.id || "");
        return { value: id, label, secondary: id, search: `${nombre} ${dni} ${id}`.toLowerCase() };
      }),
    [personas],
  );

  const personaSeleccionadaLabel = useMemo(() => {
    const hit = personaOptions.find((o) => o.value === personaId);
    return hit ? hit.label : "";
  }, [personaId, personaOptions]);

  const personaOptionsFiltradas = useMemo(() => {
    const q = personaQuery.trim().toLowerCase();
    if (!q) return personaOptions.slice(0, 80);
    return personaOptions.filter((o) => o.search.includes(q)).slice(0, 80);
  }, [personaOptions, personaQuery]);

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

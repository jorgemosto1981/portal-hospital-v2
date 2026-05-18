import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { LAO_ANIO_CORTE_PORTAL_A } from "../../constants/laoArticulo.js";
import { fetchPersonaCheckinRrhh } from "./fetchPersonaCheckinRrhh.js";
import { detectHayCheckinPrevio } from "./detectHayCheckinPrevio.js";
import { usePersonasCheckinBusqueda } from "./usePersonasCheckinBusqueda.js";
import { useCheckinPrecarga } from "./useCheckinPrecarga.js";

/**
 * @param {{
 *   anioA: number | null,
 *   setAnioCorteA: (v: string) => void,
 *   onPersonaChange: () => void,
 *   precargaSetters: {
 *     setFilas: Function,
 *     setDiasPorArticuloB: Function,
 *     setSaldosPorArticuloC: Function,
 *   },
 * }} deps
 */
export function useCheckinPersonaFlow(deps) {
  const [searchParams] = useSearchParams();
  const [personaId, setPersonaId] = useState("");
  const personaWrapRef = useRef(null);
  const personaIdAnteriorRef = useRef("");
  const lastUrlPersonaRef = useRef("");

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

  const [personaData, setPersonaData] = useState(null);
  const [loadingPersonaData, setLoadingPersonaData] = useState(false);
  const [confirmarRecargaLao, setConfirmarRecargaLao] = useState(false);
  const [confirmarRecargaGlobal, setConfirmarRecargaGlobal] = useState(false);
  const [modoCheckin, setModoCheckin] = useState(/** @type {null | 'nuevo' | 'rectificacion'} */ (null));

  const { loadingPrecarga, tieneBolsasFirestore, resetPrecargaKeys } = useCheckinPrecarga(
    personaId,
    deps.anioA,
    deps.precargaSetters,
  );

  const resetPersonaUi = useCallback(() => {
    resetPrecargaKeys();
    deps.onPersonaChange();
    setModoCheckin(null);
    setConfirmarRecargaLao(false);
    setConfirmarRecargaGlobal(false);
    setPersonaData(null);
    setPersonaOpen(false);
    setPersonaQuery("");
    deps.setAnioCorteA(String(LAO_ANIO_CORTE_PORTAL_A));
  }, [deps, resetPrecargaKeys]);

  const setPersonaIdCheckin = useCallback(
    (nextId) => {
      const next = String(nextId || "").trim();
      const prev = personaIdAnteriorRef.current;
      if (prev && next !== prev) resetPersonaUi();
      if (!next) {
        resetPersonaUi();
        personaIdAnteriorRef.current = "";
        setPersonaId("");
        return;
      }
      personaIdAnteriorRef.current = next;
      setPersonaId(next);
    },
    [resetPersonaUi],
  );

  const hayCheckinPrevio = useMemo(
    () => detectHayCheckinPrevio(personaData, { tieneBolsas: tieneBolsasFirestore }),
    [personaData, tieneBolsasFirestore],
  );

  const esRectificacion = modoCheckin === "rectificacion";
  const esNuevoCheckin = modoCheckin === "nuevo";
  const yaCheckinGlobalEarly = Boolean(personaData?.checkin_saldos_portal_en);
  const modoNuevoInvalidoConGlobalCerrado =
    yaCheckinGlobalEarly && esNuevoCheckin && !confirmarRecargaGlobal;
  const necesitaElegirModo =
    Boolean(personaId) &&
    deps.anioA != null &&
    !loadingPrecarga &&
    !loadingPersonaData &&
    hayCheckinPrevio &&
    (modoCheckin === null || modoNuevoInvalidoConGlobalCerrado);

  const yaCheckinGlobal = Boolean(personaData?.checkin_saldos_portal_en);
  const yaCheckinLao = Boolean(personaData?.checkin_lao_registrado_en);
  const bloqueoGlobalSinRecarga = yaCheckinGlobal && !confirmarRecargaGlobal && !esRectificacion;
  const forzarRecarga = esRectificacion || confirmarRecargaGlobal || confirmarRecargaLao;

  const personaSeleccionadaLabel = useMemo(() => {
    const hit = personaOptions.find((o) => o.value === personaId);
    return hit ? hit.label : personaId ? String(personaId) : "";
  }, [personaId, personaOptions]);

  const refreshPersona = useCallback(async (per) => {
    const { persona } = await fetchPersonaCheckinRrhh(per);
    setPersonaData(persona);
  }, []);

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
    void refetchPersonas(fromUrl);
  }, [searchParams, personaId, setPersonaIdCheckin, refetchPersonas]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (/^per_/i.test(per)) void refetchPersonas(per);
  }, [personaId, refetchPersonas]);

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current?.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen, setPersonaOpen]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per)) return;
    let cancelled = false;
    setLoadingPersonaData(true);
    void fetchPersonaCheckinRrhh(per)
      .then(({ persona, anioCortePortalA }) => {
        if (cancelled) return;
        setPersonaData(persona);
        if (anioCortePortalA != null) deps.setAnioCorteA(String(anioCortePortalA));
      })
      .catch((e) => {
        if (!cancelled) {
          setPersonaData(null);
          const code = e?.code ? String(e.code) : "";
          if (code.includes("permission-denied")) {
            toast.error(
              "Sin permiso RRHH para leer la persona. Cerrá sesión, volvé a entrar o ejecutá dev:set-rrhh-claims.",
            );
          } else {
            toast.error(e?.message || "No se pudo cargar el estado del agente.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPersonaData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId, deps.setAnioCorteA]);

  useEffect(() => {
    if (loadingPrecarga || loadingPersonaData || !personaId || deps.anioA == null) return;
    if (!hayCheckinPrevio) {
      setModoCheckin("nuevo");
      return;
    }
    if (personaData?.checkin_saldos_portal_en && modoCheckin === "nuevo" && !confirmarRecargaGlobal) {
      setModoCheckin(null);
    }
  }, [
    hayCheckinPrevio,
    loadingPrecarga,
    loadingPersonaData,
    personaId,
    deps.anioA,
    personaData?.checkin_saldos_portal_en,
    modoCheckin,
    confirmarRecargaGlobal,
  ]);

  const anioALectura =
    esRectificacion && personaData?.anio_corte_portal_a != null
      ? Number(personaData.anio_corte_portal_a)
      : null;

  return {
    personaWrapRef,
    loadPersonas,
    personaOpen,
    setPersonaOpen,
    personaQuery,
    setPersonaQuery,
    personaId,
    setPersonaIdCheckin,
    personaSeleccionadaLabel,
    personaOptionsFiltradas,
    personaData,
    loadingPersonaData,
    confirmarRecargaLao,
    setConfirmarRecargaLao,
    confirmarRecargaGlobal,
    setConfirmarRecargaGlobal,
    bloqueoGlobalSinRecarga,
    yaCheckinGlobal,
    yaCheckinLao,
    hayCheckinPrevio,
    necesitaElegirModo,
    modoCheckin,
    setModoCheckin,
    esRectificacion,
    esNuevoCheckin,
    forzarRecarga,
    refreshPersona,
    anioALectura,
    loadingPrecarga,
    tieneBolsasFirestore,
    resetPrecargaKeys,
  };
}

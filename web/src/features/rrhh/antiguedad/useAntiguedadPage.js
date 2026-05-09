import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  callListarColeccion,
  callListarColeccionPublicaTemporal,
  callRrhhCalcularAntiguedadPersona,
  callRrhhEliminarAntiguedadExternaPersona,
  callRrhhGuardarAntiguedadExternaPersona,
} from "../../../services/callables.js";

import { construirTextoResumen } from "./resumenTexto.js";
import { formatDdMmAaaa, todayIso } from "./dateIso.js";

export function useAntiguedadPage() {
  const [personas, setPersonas] = useState([]);
  const [load, setLoad] = useState(true);
  const [personaId, setPersonaId] = useState("");
  const [usaFechaEspecifica, setUsaFechaEspecifica] = useState(false);
  const [fechaCorte, setFechaCorte] = useState(() => todayIso());
  const [busyCalculo, setBusyCalculo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aExt, setAExt] = useState("0");
  const [mExt, setMExt] = useState("0");
  const [dExt, setDExt] = useState("0");
  const [normativa, setNormativa] = useState("");
  const [desde, setDesde] = useState(() => todayIso());
  const [busyGuardarExterna, setBusyGuardarExterna] = useState(false);
  const [busyEliminarExterna, setBusyEliminarExterna] = useState(false);
  const [personaQuery, setPersonaQuery] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const personaWrapRef = useRef(null);
  const [cfgEscalafon, setCfgEscalafon] = useState([]);
  const [cfgAgrupamiento, setCfgAgrupamiento] = useState([]);
  const [cfgTipoVinculo, setCfgTipoVinculo] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoad(true);
    Promise.all([
      callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 400 }),
      callListarColeccion({ collectionName: "cfg_escalafon" }),
      callListarColeccion({ collectionName: "cfg_agrupamiento" }),
      callListarColeccion({ collectionName: "cfg_tipo_vinculo_laboral" }),
    ])
      .then(([respPersonas, respEsc, respAgr, respVin]) => {
        if (!mounted) return;
        const items = respPersonas?.data?.items || [];
        setPersonas(items);
        setPersonaId((prev) => {
          const current = String(prev || "").trim();
          if (!current) return "";
          const exists = items.some((p) => String(p?.id || "").trim() === current);
          return exists ? current : "";
        });
        setCfgEscalafon(respEsc?.data?.items || []);
        setCfgAgrupamiento(respAgr?.data?.items || []);
        setCfgTipoVinculo(respVin?.data?.items || []);
      })
      .catch((error) => {
        toast.error(error?.message || "No se pudo cargar personas.");
      })
      .finally(() => {
        if (mounted) setLoad(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setResultado(null);
  }, [personaId]);

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current) return;
      if (!personaWrapRef.current.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen]);

  const fechaCorteEfectiva = useMemo(() => (usaFechaEspecifica ? fechaCorte : todayIso()), [usaFechaEspecifica, fechaCorte]);
  const personaOptions = useMemo(
    () =>
      (personas || []).map((p) => {
        const nombre = `${String(p?.nombre || "").trim()} ${String(p?.apellido || "").trim()}`.trim();
        const dni = String(p?.dni || "").trim();
        const selectedLabel = nombre ? `${nombre} · DNI ${dni || "—"}` : `DNI ${dni || "—"}`;
        return {
          value: String(p.id || ""),
          label: selectedLabel,
          selectedLabel,
          secondary: String(p.id || ""),
        };
      }),
    [personas],
  );
  const personaOptionsFiltradas = useMemo(() => {
    const q = String(personaQuery || "").trim().toLowerCase();
    if (!q) return personaOptions;
    return personaOptions.filter((o) =>
      [o.label, o.secondary, o.selectedLabel].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [personaOptions, personaQuery]);
  const personaSeleccionadaLabel = useMemo(() => {
    const o = personaOptions.find((x) => String(x.value) === String(personaId || ""));
    return o ? (o.selectedLabel || o.label) : "";
  }, [personaOptions, personaId]);
  const personaActiva = useMemo(
    () => personas.find((p) => String(p?.id || "") === String(personaId || "")) || null,
    [personas, personaId],
  );
  const reconocimientosGuardados = useMemo(() => {
    if (!personaActiva) return [];
    return Array.isArray(personaActiva.antiguedad_reconocimientos)
      ? personaActiva.antiguedad_reconocimientos
      : [];
  }, [personaActiva]);
  const personaActivaDescripcionReconocimientos = useMemo(() => {
    if (!personaActiva) return "persona no seleccionada";
    const nombre = `${String(personaActiva?.nombre || "").trim()} ${String(personaActiva?.apellido || "").trim()}`.trim();
    const dni = String(personaActiva?.dni || "").trim();
    const base = nombre || "Sin nombre";
    const dniPart = dni ? ` · DNI ${dni}` : " · DNI —";
    return `${base}${dniPart}`;
  }, [personaActiva]);
  const personaActivaId = useMemo(
    () => String(personaActiva?.id || personaId || "").trim(),
    [personaActiva, personaId],
  );
  const idxEscalafon = useMemo(
    () => new Map((cfgEscalafon || []).map((x) => [String(x.id || ""), x])),
    [cfgEscalafon],
  );
  const idxAgrupamiento = useMemo(
    () => new Map((cfgAgrupamiento || []).map((x) => [String(x.id || ""), x])),
    [cfgAgrupamiento],
  );
  const idxTipoVinculo = useMemo(
    () => new Map((cfgTipoVinculo || []).map((x) => [String(x.id || ""), x])),
    [cfgTipoVinculo],
  );
  async function calcular() {
    if (!personaId) {
      toast.error("Seleccioná un persona_id.");
      return;
    }
    setBusyCalculo(true);
    const t = toast.loading("Calculando antigüedad...");
    try {
      const { data } = await callRrhhCalcularAntiguedadPersona({
        persona_id: personaId,
        fecha_corte: fechaCorteEfectiva,
      });
      setResultado(data?.resultado || null);
      toast.success("Antigüedad calculada.", { id: t });
    } catch (error) {
      toast.error(error?.message || "No se pudo calcular antigüedad.", { id: t });
    } finally {
      setBusyCalculo(false);
    }
  }

  async function guardarAntiguedadExterna() {
    if (!personaId) {
      toast.error("Seleccioná un persona_id.");
      return;
    }
    if (!normativa.trim()) {
      toast.error("Completá normativa.");
      return;
    }
    if (reconocimientosGuardados.length > 0) {
      toast.error("Ya existe antigüedad externa cargada. Eliminá la existente para cargar una nueva.");
      return;
    }
    if (!desde) {
      toast.error("Completá fecha 'desde'.");
      return;
    }
    const months = Number(mExt);
    const days = Number(dExt);
    if (!Number.isFinite(months) || months < 0 || months > 11) {
      toast.error("Meses debe estar entre 0 y 11.");
      return;
    }
    if (!Number.isFinite(days) || days < 0 || days > 31) {
      toast.error("Días debe estar entre 0 y 31.");
      return;
    }
    setBusyGuardarExterna(true);
    const t = toast.loading("Guardando antigüedad externa...");
    try {
      await callRrhhGuardarAntiguedadExternaPersona({
        persona_id: personaId,
        anios: aExt,
        meses: mExt,
        dias: dExt,
        normativa,
        desde,
      });
      toast.success("Antigüedad externa guardada.", { id: t });
      setAExt("0");
      setMExt("0");
      setDExt("0");
      setNormativa("");
      setDesde(todayIso());
      const refreshed = await callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 400 });
      setPersonas(refreshed?.data?.items || []);
      await calcular();
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar antigüedad externa.", { id: t });
    } finally {
      setBusyGuardarExterna(false);
    }
  }

  async function eliminarAntiguedadExterna() {
    if (!personaId) {
      toast.error("Seleccioná un persona_id.");
      return;
    }
    if (reconocimientosGuardados.length === 0) {
      toast.error("No hay antigüedad externa para eliminar.");
      return;
    }
    setBusyEliminarExterna(true);
    const t = toast.loading("Eliminando antigüedad externa...");
    try {
      await callRrhhEliminarAntiguedadExternaPersona({ persona_id: personaId });
      const refreshed = await callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 400 });
      setPersonas(refreshed?.data?.items || []);
      await calcular();
      toast.success("Antigüedad externa eliminada.", { id: t });
    } catch (error) {
      toast.error(error?.message || "No se pudo eliminar antigüedad externa.", { id: t });
    } finally {
      setBusyEliminarExterna(false);
    }
  }

  const fechaCorteResumenDdMm = useMemo(
    () =>
      formatDdMmAaaa(
        resultado?.detalleCalculo?.fechaCorteAplicada || (usaFechaEspecifica ? fechaCorte : todayIso()),
      ),
    [resultado, usaFechaEspecifica, fechaCorte],
  );

  async function copiarResumenAntiguedad() {
    if (!resultado || !personaId) {
      toast.error("Calculá primero la antigüedad.");
      return;
    }
    const text = construirTextoResumen({
      personaId,
      personaLabel: personaSeleccionadaLabel || personaId,
      fechaCorteDdMm: fechaCorteResumenDdMm,
      resultado,
      idxEscalafon,
      idxAgrupamiento,
      idxTipoVinculo,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumen copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar (revisá permisos del navegador).");
    }
  }

  function imprimirPaginaAntiguedad() {
    window.print();
  }

  const calculoCardProps = {
    personaWrapRef,
    load,
    personaOpen,
    personaQuery,
    personaSeleccionadaLabel,
    setPersonaOpen,
    setPersonaQuery,
    setPersonaId,
    personaOptionsFiltradas,
    usaFechaEspecifica,
    setUsaFechaEspecifica,
    fechaCorte,
    setFechaCorte,
    fechaCorteEfectivaIso: fechaCorteEfectiva,
    resultado,
    personaId,
    busyCalculo,
    onCalcular: calcular,
  };

  const externaCardProps = {
    aExt,
    setAExt,
    mExt,
    setMExt,
    dExt,
    setDExt,
    normativa,
    setNormativa,
    desde,
    setDesde,
    personaId,
    reconocimientosGuardados,
    personaActivaDescripcionReconocimientos,
    personaActivaId,
    busyGuardarExterna,
    busyEliminarExterna,
    onGuardarExterna: guardarAntiguedadExterna,
    onEliminarExterna: eliminarAntiguedadExterna,
  };

  const resultadoCardProps = resultado
    ? {
        resultado,
        personaSeleccionadaLabel,
        personaId,
        fechaCorteResumenDdMm,
        onCopiarResumen: copiarResumenAntiguedad,
        onImprimir: imprimirPaginaAntiguedad,
        idxEscalafon,
        idxAgrupamiento,
        idxTipoVinculo,
      }
    : null;

  return {
    calculoCardProps,
    externaCardProps,
    resultadoCardProps,
  };
}

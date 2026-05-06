import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import {
  callListarColeccionPublicaTemporal,
  callListarColeccion,
  callRrhhCalcularAntiguedadPersona,
  callRrhhEliminarAntiguedadExternaPersona,
  callRrhhGuardarAntiguedadExternaPersona,
} from "../services/callables.js";
import {
  AntiguedadResultadoCard,
  construirTextoResumen,
  formatDdMmAaaa,
  todayIso,
} from "../features/rrhh/antiguedad/index.js";

export default function Antiguedad() {
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
        setPersonaId((prev) => prev || (items[0]?.id || ""));
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

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8 print:max-w-none print:px-4 print:py-3">
      <div className="mx-auto w-full max-w-6xl space-y-4 print:max-w-none">
        <Card className="print:hidden px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Antigüedad</h1>
          <p className="mt-2 text-sm text-slate-600">
            HLC: se fusionan solapes solo entre cargos (misma persona). Crédito externo: suma administrativa A/M/D tras
            validar fechas; no se cruza con fechas de HLC.
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-800">Cómo se calcula la antigüedad</p>
            <p className="mt-1">1. HLC: períodos fusionados (sin doble conteo) y expresados en años/meses/días (base 365/30).</p>
            <p className="mt-1">
              2. Crédito externo: los años/meses/días informados se suman a ese desglose (sin analizar solapamiento con
              períodos HLC), solo si la fecha de cálculo es igual o posterior a la fecha de implementación.
            </p>
            <p className="mt-1">
              3. Acarreo: si los días suman más de 29, suma 1 mes y resta 30 días; si los meses suman más de 11, suma 1 año
              y resta 12 meses.
            </p>
            <p className="mt-1">4. El total en días mostrado es referencial (365/30) a partir del resultado final A/M/D.</p>
          </div>
        </Card>

        <Card className="print:hidden px-4 py-4 md:px-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div ref={personaWrapRef} className="relative text-sm text-slate-700">
              <label className="block text-xs font-semibold tracking-wide text-slate-600">
                <span className="uppercase">PERSONA</span>
                <span className="field-id ml-1 text-[11px] text-slate-500">(persona_id)</span>
              </label>
              <input
                value={personaOpen ? personaQuery : personaSeleccionadaLabel}
                onFocus={() => {
                  setPersonaOpen(true);
                  setPersonaQuery("");
                }}
                onChange={(e) => {
                  setPersonaOpen(true);
                  setPersonaQuery(e.target.value);
                }}
                placeholder="Buscar por nombre, apellido, DNI o ID..."
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                disabled={load}
              />
              {personaOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonaId("");
                      setPersonaQuery("");
                      setPersonaOpen(false);
                    }}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                  >
                    Seleccionar persona...
                  </button>
                  {personaOptionsFiltradas.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>
                  ) : (
                    personaOptionsFiltradas.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setPersonaId(o.value);
                          setPersonaQuery("");
                          setPersonaOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
                      >
                        <span className="block">{o.label}</span>
                        {o.secondary ? <span className="block text-xs italic text-slate-500">({o.secondary})</span> : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={usaFechaEspecifica}
                  onChange={(e) => setUsaFechaEspecifica(e.target.checked)}
                />
                Cambiar fecha de cálculo (por defecto hoy)
              </label>
              <label className="mt-2 block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Fecha de corte</span>
                <input
                  type="date"
                  value={fechaCorte}
                  onChange={(e) => setFechaCorte(e.target.value)}
                  disabled={!usaFechaEspecifica}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">Fecha efectiva: {formatDdMmAaaa(fechaCorteEfectiva)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={calcular}
              disabled={busyCalculo || load || !personaId}
              className="min-h-11 touch-manipulation rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {busyCalculo ? "Calculando..." : "Calcular antigüedad"}
            </button>
          </div>
          {!resultado && personaId && !busyCalculo ? (
            <p className="mt-3 text-xs text-slate-500">
              El resultado no se actualiza solo: usá <span className="font-medium text-slate-700">Calcular antigüedad</span>{" "}
              para ver el desglose (HLC, crédito externo si aplica y total).
            </p>
          ) : null}
        </Card>

        <Card className="print:hidden px-4 py-4 md:px-5">
          <h2 className="text-base font-semibold text-slate-900">Antigüedad externa / reconocida</h2>
          <p className="mt-1 text-xs text-slate-500">
            Se guarda por persona y se usa automáticamente en el cálculo si la fecha de impacto aplica al corte.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Años</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={aExt}
                onChange={(e) => setAExt(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Meses</span>
              <input
                type="number"
                min="0"
                max="11"
                inputMode="numeric"
                value={mExt}
                onChange={(e) => setMExt(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Días</span>
              <input
                type="number"
                min="0"
                max="31"
                inputMode="numeric"
                value={dExt}
                onChange={(e) => setDExt(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">Normativa</span>
              <input
                type="text"
                value={normativa}
                onChange={(e) => setNormativa(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Ej. Resolución 123/2026"
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Desde</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <div className="md:col-span-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={guardarAntiguedadExterna}
                  disabled={busyGuardarExterna || !personaId || reconocimientosGuardados.length > 0}
                  className="min-h-11 touch-manipulation rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white active:bg-slate-900 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  {busyGuardarExterna ? "Guardando..." : "Guardar antigüedad externa"}
                </button>
                <button
                  type="button"
                  onClick={eliminarAntiguedadExterna}
                  disabled={busyEliminarExterna || !personaId || reconocimientosGuardados.length === 0}
                  className="min-h-11 touch-manipulation rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 active:bg-red-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                >
                  {busyEliminarExterna ? "Eliminando..." : "Eliminar antigüedad externa"}
                </button>
              </div>
              {reconocimientosGuardados.length > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  Solo se permite una antigüedad externa por persona. Eliminá la actual para cargar otra.
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-sm font-medium text-slate-700">
              Reconocimientos guardados para{" "}
              <span>
                {personaActivaDescripcionReconocimientos}
                {personaActivaId ? (
                  <>
                    {" "}
                    <span className="italic">({personaActivaId})</span>
                  </>
                ) : null}
              </span>
            </p>
            {reconocimientosGuardados.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No hay antigüedad reconocida cargada.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {reconocimientosGuardados.map((rec, idx) => (
                  <li key={String(rec?.reconocimiento_id || idx)}>
                    {`${Number(rec?.anios || 0)}a ${Number(rec?.meses || 0)}m ${Number(rec?.dias || 0)}d · ${
                      rec?.normativa || "Sin normativa"
                    } · Desde ${formatDdMmAaaa(rec?.fecha_impacto || "")} · Estado ${String(rec?.estado || "vigente")}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {resultado ? (
          <AntiguedadResultadoCard
            resultado={resultado}
            personaSeleccionadaLabel={personaSeleccionadaLabel}
            personaId={personaId}
            fechaCorteResumenDdMm={fechaCorteResumenDdMm}
            onCopiarResumen={copiarResumenAntiguedad}
            onImprimir={imprimirPaginaAntiguedad}
            idxEscalafon={idxEscalafon}
            idxAgrupamiento={idxAgrupamiento}
            idxTipoVinculo={idxTipoVinculo}
          />
        ) : null}
      </div>
    </div>
  );
}

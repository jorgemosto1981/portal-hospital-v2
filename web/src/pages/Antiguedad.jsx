import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import {
  callListarColeccionPublicaTemporal,
  callListarColeccion,
  callRrhhCalcularAntiguedadPersona,
  callRrhhGuardarAntiguedadExternaPersona,
} from "../services/callables.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDdMmAaaa(isoYmd) {
  const raw = String(isoYmd || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "—";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function diasAAniosMesesDias(totalDiasRaw) {
  const totalDias = Math.max(0, Number(totalDiasRaw || 0));
  const anios = Math.floor(totalDias / 365);
  const resto = totalDias % 365;
  const meses = Math.floor(resto / 30);
  const dias = resto % 30;
  return `${anios} años, ${meses} meses, ${dias} días`;
}

function catalogLabel(item) {
  if (!item) return "";
  if (typeof item.titulo_ui === "string" && item.titulo_ui.trim()) return item.titulo_ui.trim();
  if (typeof item.nombre === "string" && item.nombre.trim()) return item.nombre.trim();
  return String(item.id || "").trim();
}

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

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Antigüedad</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cálculo base por HLC (sin duplicar solapes) y antigüedad externa reconocida para licencias.
          </p>
        </Card>

        <Card className="px-4 py-4 md:px-5">
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
              className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busyCalculo ? "Calculando..." : "Calcular antigüedad"}
            </button>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
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
              <button
                type="button"
                onClick={guardarAntiguedadExterna}
                disabled={busyGuardarExterna || !personaId}
                className="min-h-11 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyGuardarExterna ? "Guardando..." : "Guardar antigüedad externa"}
              </button>
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
          <Card className="px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold text-slate-900">Resultado</h2>
            <div className="mt-2 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total calculado</p>
              <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
                {resultado.totalDiasCalculados} días
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {resultado.años} años, {resultado.meses} meses, {resultado.dias} días
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Corte aplicado: {formatDdMmAaaa(resultado.detalleCalculo?.fechaCorteAplicada || "")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              HLC válidas: {resultado.detalleCalculo?.resumen?.cantidadHlcValidas || 0} · Intervalos fusionados:{" "}
              {resultado.detalleCalculo?.resumen?.cantidadIntervalosFusionados || 0}
            </p>
            {(resultado.detalleCalculo?.hlcConsideradas || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <p className="text-xs font-semibold text-indigo-700">📌 HLC consideradas</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.hlcConsideradas || []).map((item, idx) => (
                    <li key={`hlc-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                      <p className="text-xs text-slate-700">
                        {`${catalogLabel(idxEscalafon.get(String(item.escalafon_id || ""))) || item.escalafon_id || "Escalafón —"} · ${
                          catalogLabel(idxAgrupamiento.get(String(item.agrupamiento_id || ""))) ||
                          item.agrupamiento_id ||
                          "Agrupamiento —"
                        } · ${
                          catalogLabel(idxTipoVinculo.get(String(item.tipo_vinculo_id || ""))) ||
                          item.tipo_vinculo_id ||
                          "Tipo de vínculo —"
                        }`}
                      </p>
                      <p className="mt-1 pl-2 text-xs text-slate-600">
                        {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin_topada)} · ${
                          item.dias
                        } días · ${diasAAniosMesesDias(item.dias)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(resultado.detalleCalculo?.intervalosFusionados || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-xs font-semibold text-emerald-700">🔗 Intervalos HLC fusionados</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.intervalosFusionados || []).map((item, idx) => (
                    <li key={`fused-${idx}`} className="rounded-lg border border-emerald-100 bg-white px-2 py-2">
                      {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin)} · ${item.dias} días · ${diasAAniosMesesDias(
                        item.dias,
                      )}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Externos aplicados: {resultado.detalleCalculo?.diasExternosAplicados || 0} días ·{" "}
              {diasAAniosMesesDias(resultado.detalleCalculo?.diasExternosAplicados || 0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Externos reconocidos: {resultado.detalleCalculo?.resumen?.diasExternosReconocidos || 0} días · Solapados descartados:{" "}
              {resultado.detalleCalculo?.resumen?.diasExternosSolapadosDescartados || 0} días
            </p>
            {(resultado.detalleCalculo?.externosConsiderados || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <p className="text-xs font-semibold text-sky-700">✅ Externos aplicados</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.externosConsiderados || []).map((rec, idx) => (
                    <li key={`ext-ok-${idx}`} className="rounded-lg border border-sky-100 bg-white px-2 py-2">
                      {`${Number(rec?.anios || 0)}a ${Number(rec?.meses || 0)}m ${Number(rec?.dias || 0)}d · ${
                        rec?.normativa || "Sin normativa"
                      } · Desde ${formatDdMmAaaa(rec?.fecha_impacto || "")} · Neto ${
                        rec?.dias_netos_aplicados ?? rec?.dias_reconocidos ?? 0
                      } días`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(resultado.detalleCalculo?.intervalosExternosFusionados || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
                <p className="text-xs font-semibold uppercase text-cyan-700">🧩 Intervalos EXTERNOS fusionados</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.intervalosExternosFusionados || []).map((rec, idx) => {
                    const dias = Number(rec?.dias || 0);
                    return (
                      <li key={`ext-fused-${idx}`} className="rounded-lg border border-cyan-100 bg-white px-2 py-2">
                        {`${formatDdMmAaaa(rec?.fecha_inicio || "")} a ${formatDdMmAaaa(
                          rec?.fecha_fin || "",
                        )} · ${dias} días · ${diasAAniosMesesDias(dias)}`}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {(resultado.detalleCalculo?.externosExcluidosPorCorte || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">⚠️ Externos no aplicados por corte</p>
                <ul className="mt-1 space-y-1 text-xs text-amber-700">
                  {(resultado.detalleCalculo?.externosExcluidosPorCorte || []).map((rec, idx) => (
                    <li key={`ext-skip-${idx}`} className="rounded-lg border border-amber-200 bg-white px-2 py-2">
                      {`${rec?.detalle?.normativa || "Sin normativa"} · Desde ${formatDdMmAaaa(
                        rec?.detalle?.fecha_impacto || "",
                      )} · No aplicado: ${rec?.motivo || "fuera de corte"}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

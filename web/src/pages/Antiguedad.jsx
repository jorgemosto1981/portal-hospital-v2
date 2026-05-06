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

const MS_DIA = 86400000;

function parseIsoYmdToUtcMs(isoYmd) {
  const raw = String(isoYmd || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  const y = Number(match[1]);
  const mo = Number(match[2]) - 1;
  const d = Number(match[3]);
  const utc = Date.UTC(y, mo, d);
  const chk = new Date(utc);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo || chk.getUTCDate() !== d) return NaN;
  return utc;
}

/** Suma cruda HLC + externo antes del acarreo (debe coincidir con amdFinal si no hubo ajuste). */
function detectarAcarreo(det) {
  if (!det?.amdHlc || !det?.amdFinal) return { hubo: false, antes: null };
  const ext = det.amdExternoSumadoRaw || { años: 0, meses: 0, dias: 0 };
  const antes = {
    años: det.amdHlc.años + ext.años,
    meses: det.amdHlc.meses + ext.meses,
    dias: det.amdHlc.dias + ext.dias,
  };
  const f = det.amdFinal;
  const hubo =
    antes.años !== f.años || antes.meses !== f.meses || antes.dias !== f.dias;
  return { hubo, antes, despues: f };
}

/** Marcador tipográfico pequeño (evita SVG que sin tamaño explícito se ven enormes). */
function MarcadorInline({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center text-[11px] font-semibold leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {children}
    </span>
  );
}

function TimelineHlcFusionados({ intervalos, fechaCorteIso }) {
  const layout = useMemo(() => {
    if (!intervalos?.length) return null;
    const rows = intervalos.map((it, idx) => {
      const start = parseIsoYmdToUtcMs(it.fecha_inicio);
      const end = parseIsoYmdToUtcMs(it.fecha_fin);
      return {
        idx,
        start,
        end,
        dias: it.dias,
        labelIni: formatDdMmAaaa(it.fecha_inicio),
        labelFin: formatDdMmAaaa(it.fecha_fin),
        ok: Number.isFinite(start) && Number.isFinite(end) && end >= start,
      };
    });
    const valid = rows.filter((r) => r.ok);
    if (!valid.length) return null;
    const corteMs = fechaCorteIso ? parseIsoYmdToUtcMs(fechaCorteIso) : NaN;
    let minT = Math.min(...valid.map((r) => r.start));
    let maxT = Math.max(...valid.map((r) => r.end));
    if (Number.isFinite(corteMs)) maxT = Math.max(maxT, corteMs);
    const span = Math.max(MS_DIA, maxT - minT);
    return { valid, minT, maxT, span, corteMs };
  }, [intervalos, fechaCorteIso]);

  if (!layout) return null;
  const { valid, minT, span, corteMs } = layout;

  return (
    <div className="mt-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-3 py-3 print:break-inside-avoid">
      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <MarcadorInline className="text-emerald-700">■</MarcadorInline>
        Línea de tiempo (HLC fusionados)
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Escala relativa entre el inicio del primer tramo y el fin del corte. Cada barra es un intervalo ya fusionado.
      </p>
      <div className="relative mt-3 h-14 rounded-lg bg-white/90 px-1 ring-1 ring-emerald-100 print:bg-white">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200" aria-hidden />
        {valid.map((r) => {
          const leftPct = ((r.start - minT) / span) * 100;
          const wPct = Math.max(0.8, ((r.end - r.start + MS_DIA) / span) * 100);
          return (
            <div
              key={`tl-${r.idx}`}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${leftPct}%`, width: `${wPct}%`, minWidth: "4px" }}
            >
              <span
                className="h-8 w-full min-w-[6px] rounded-t-md bg-emerald-500/90 print:bg-emerald-600"
                title={`${r.labelIni} → ${r.labelFin} · ${r.dias} días`}
              />
              <span className="mt-0.5 max-w-full truncate px-0.5 text-center text-[9px] font-medium text-slate-600 print:text-slate-800">
                {r.dias}d
              </span>
            </div>
          );
        })}
        {Number.isFinite(corteMs) ? (
          <div
            className="absolute bottom-0 top-0 z-10 w-px bg-amber-500 print:bg-amber-600"
            style={{ left: `${((corteMs - minT) / span) * 100}%` }}
            title={`Corte ${formatDdMmAaaa(fechaCorteIso)}`}
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-1 text-[10px] text-slate-500 print:text-slate-700">
        {(() => {
          const sorted = [...valid].sort((a, b) => a.start - b.start);
          const ini = sorted[0];
          const fin = sorted[sorted.length - 1];
          return (
            <>
              <span>{ini ? ini.labelIni : "—"}</span>
              <span>
                Corte: {formatDdMmAaaa(fechaCorteIso)} {Number.isFinite(corteMs) ? "(línea ámbar)" : ""}
              </span>
              <span>{fin ? fin.labelFin : "—"}</span>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function construirTextoResumen({
  personaId,
  personaLabel,
  fechaCorteDdMm,
  resultado,
  idxEscalafon,
  idxAgrupamiento,
  idxTipoVinculo,
}) {
  const det = resultado?.detalleCalculo;
  const lines = [];
  lines.push("PORTAL — Antigüedad (resumen copiado)");
  lines.push(`Persona: ${personaLabel}`);
  lines.push(`persona_id: ${personaId}`);
  lines.push(`Fecha de corte: ${fechaCorteDdMm}`);
  lines.push(
    `Total: ${resultado.totalDiasCalculados} días (ref. 365/30) · ${formatoAmdLegible({
      años: resultado.años,
      meses: resultado.meses,
      dias: resultado.dias,
    })}`,
  );
  const ac = detectarAcarreo(det);
  if (ac.hubo && ac.antes) {
    lines.push(
      `Acarreo aplicado: antes ${ac.antes.años}a ${ac.antes.meses}m ${ac.antes.dias}d → después ${ac.despues.años}a ${ac.despues.meses}m ${ac.despues.dias}d`,
    );
  } else {
    lines.push("Acarreo: no fue necesario (suma cruda = total final).");
  }
  if (det?.amdHlc) {
    lines.push(`HLC (365/30): ${formatoAmdLegible(det.amdHlc)}`);
  }
  if (det?.amdExternoSumadoRaw) {
    const e = det.amdExternoSumadoRaw;
    if (e.años > 0 || e.meses > 0 || e.dias > 0) {
      lines.push(`Crédito externo sumado: ${formatoAmdLegible(e)}`);
    }
  }
  lines.push(`HLC válidas: ${det?.resumen?.cantidadHlcValidas ?? 0} · Fusionados: ${det?.resumen?.cantidadIntervalosFusionados ?? 0}`);
  const fusionados = det?.intervalosFusionados || [];
  if (fusionados.length) {
    lines.push("Intervalos HLC fusionados:");
    fusionados.forEach((it) => {
      lines.push(`  - ${formatDdMmAaaa(it.fecha_inicio)} a ${formatDdMmAaaa(it.fecha_fin)} · ${it.dias} días`);
    });
  }
  const hlc = det?.hlcConsideradas || [];
  if (hlc.length) {
    lines.push("HLC consideradas (detalle):");
    hlc.forEach((item) => {
      const esc = catalogLabel(idxEscalafon.get(String(item.escalafon_id || ""))) || item.escalafon_id || "—";
      const agr = catalogLabel(idxAgrupamiento.get(String(item.agrupamiento_id || ""))) || item.agrupamiento_id || "—";
      const vin = catalogLabel(idxTipoVinculo.get(String(item.tipo_vinculo_id || ""))) || item.tipo_vinculo_id || "—";
      lines.push(`  - ${esc} · ${agr} · ${vin}`);
      lines.push(`    ${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin_topada)} · ${item.dias} días`);
    });
  }
  (det?.externosConsiderados || []).forEach((rec) => {
    lines.push(
      `Externo APLICA: ${rec?.normativa || "—"} · ${formatDdMmAaaa(rec?.fecha_impacto)} · A/M/D ${rec?.amd_aportado ? `${rec.amd_aportado.años}/${rec.amd_aportado.meses}/${rec.amd_aportado.dias}` : "—"}`,
    );
  });
  (det?.externosExcluidosPorCorte || []).forEach((row) => {
    lines.push(
      `Externo NO aplica: ${row?.detalle?.normativa || "—"} · ${formatDdMmAaaa(row?.detalle?.fecha_impacto)} · ${row?.motivo || ""}`,
    );
  });
  if ((det?.reglasAplicadas || []).length) {
    lines.push("Reglas del motor:");
    det.reglasAplicadas.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  lines.push(`Generado: ${new Date().toISOString()}`);
  return lines.join("\n");
}

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

/** Misma base 365/30 que el motor; para textos legales con “y” antes del último término. */
function amdLegibleDesdeDias(totalDiasRaw) {
  const totalDias = Math.max(0, Number(totalDiasRaw || 0));
  const anios = Math.floor(totalDias / 365);
  const resto = totalDias % 365;
  const meses = Math.floor(resto / 30);
  const dias = resto % 30;
  const partes = [];
  partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function formatoAmdLegible(amd) {
  if (!amd || typeof amd !== "object") return "—";
  const a = Math.max(0, Number(amd.años ?? amd.anios ?? 0));
  const m = Math.max(0, Number(amd.meses ?? 0));
  const d = Math.max(0, Number(amd.dias ?? 0));
  const partes = [
    `${a} ${a === 1 ? "año" : "años"}`,
    `${m} ${m === 1 ? "mes" : "meses"}`,
    `${d} ${d === 1 ? "día" : "días"}`,
  ];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function amdLegibleDesdeReconocimiento(rec) {
  if (rec?.amd_aportado && typeof rec.amd_aportado === "object") {
    return formatoAmdLegible(rec.amd_aportado);
  }
  const a = Math.max(0, Number(rec?.anios ?? 0));
  const m = Math.max(0, Number(rec?.meses ?? 0));
  const d = Math.max(0, Number(rec?.dias_desglose_normativo ?? rec?.dias ?? 0));
  const partes = [];
  partes.push(`${a} ${a === 1 ? "año" : "años"}`);
  partes.push(`${m} ${m === 1 ? "mes" : "meses"}`);
  partes.push(`${d} ${d === 1 ? "día" : "días"}`);
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function catalogLabel(item) {
  if (!item) return "";
  if (typeof item.titulo_ui === "string" && item.titulo_ui.trim()) return item.titulo_ui.trim();
  if (typeof item.nombre === "string" && item.nombre.trim()) return item.nombre.trim();
  return String(item.id || "").trim();
}

/** Tarjeta A/M/D para lectura rápida (móvil primero). */
function TarjetaAmdPaso({ titulo, amd, pie, className = "" }) {
  const tiene = amd && typeof amd === "object";
  const a = tiene ? Math.max(0, Number(amd.años ?? amd.anios ?? 0)) : null;
  const m = tiene ? Math.max(0, Number(amd.meses ?? 0)) : null;
  const d = tiene ? Math.max(0, Number(amd.dias ?? 0)) : null;
  return (
    <div
      className={`rounded-xl border px-3 py-3 shadow-sm ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      {tiene ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {a}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">a</span>
            </span>
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {m}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">m</span>
            </span>
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {d}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">d</span>
            </span>
          </div>
          <p className="mt-2 text-xs leading-snug text-slate-600">{formatoAmdLegible(amd)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{pie || "—"}</p>
      )}
    </div>
  );
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

  const hlcConsideradasCount = resultado?.detalleCalculo?.hlcConsideradas?.length ?? 0;
  const detalleKey = resultado?.detalleCalculo?.fechaCorteAplicada
    ? `${resultado.detalleCalculo.fechaCorteAplicada}-${hlcConsideradasCount}`
    : "sin-detalle";

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
          <Card className="print:break-inside-avoid px-4 py-4 md:px-5 print:border print:border-slate-300 print:shadow-none">
            <div className="mb-3 hidden print:block">
              <h1 className="text-lg font-bold text-slate-900">Antigüedad — impresión</h1>
              <p className="mt-1 text-sm text-slate-800">
                {personaSeleccionadaLabel || "—"}{" "}
                {personaId ? <span className="italic text-slate-600">({personaId})</span> : null}
              </p>
              <p className="text-xs text-slate-600">Fecha de corte: {fechaCorteResumenDdMm}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900">Resultado</h2>
              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  onClick={copiarResumenAntiguedad}
                  className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Copiar resumen
                </button>
                <button
                  type="button"
                  onClick={imprimirPaginaAntiguedad}
                  className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Imprimir
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3 print:bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total calculado</p>
              <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
                {formatoAmdLegible({
                  años: resultado.años,
                  meses: resultado.meses,
                  dias: resultado.dias,
                })}
              </p>
              <p className="mt-2 text-sm font-normal text-slate-500 md:text-base">
                <span className="text-slate-500">Equiv. referencial (365/30): </span>
                <span className="tabular-nums text-slate-600">{resultado.totalDiasCalculados}</span>
                <span className="text-slate-500"> días · dato complementario</span>
              </p>
              <p className="mt-2 border-t border-blue-100/80 pt-2 text-[11px] text-slate-600">
                La cifra principal del cómputo es el desglose en años, meses y días. Los días totales sirven como
                referencia para cruzar con otros módulos.
              </p>
            </div>

            {resultado.detalleCalculo?.amdHlc && resultado.detalleCalculo?.amdFinal ? (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-800">Ecuación del cómputo (A/M/D)</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Suma directa tras validar fechas; sin cruzar fechas del externo con períodos HLC.
                </p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-2">
                  <div className="min-w-0 flex-1">
                    <TarjetaAmdPaso
                      titulo="Solo HLC (365/30)"
                      amd={resultado.detalleCalculo.amdHlc}
                      className="border-slate-200 bg-slate-50/90"
                    />
                  </div>
                  <div className="flex items-center justify-center py-1 md:w-10 md:py-0">
                    <span className="text-lg font-bold leading-none text-slate-400" aria-hidden="true">
                      +
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <TarjetaAmdPaso
                      titulo="Crédito externo sumado"
                      amd={
                        resultado.detalleCalculo.amdExternoSumadoRaw &&
                        (resultado.detalleCalculo.amdExternoSumadoRaw.años > 0 ||
                          resultado.detalleCalculo.amdExternoSumadoRaw.meses > 0 ||
                          resultado.detalleCalculo.amdExternoSumadoRaw.dias > 0)
                          ? resultado.detalleCalculo.amdExternoSumadoRaw
                          : null
                      }
                      pie="0 (sin reconocimiento aplicado)"
                      className="border-sky-100 bg-sky-50/80"
                    />
                  </div>
                  <div className="flex items-center justify-center py-1 md:w-10 md:py-0">
                    <span className="text-lg font-bold leading-none text-slate-400" aria-hidden="true">
                      =
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <TarjetaAmdPaso
                      titulo="Total (tras acarreo)"
                      amd={resultado.detalleCalculo.amdFinal}
                      className="border-blue-200 bg-blue-50/90"
                    />
                  </div>
                </div>
                {(() => {
                  const ac = detectarAcarreo(resultado.detalleCalculo);
                  if (!ac.hubo || !ac.antes) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 print:break-inside-avoid">
                      <span className="mt-0.5 shrink-0 rounded-md bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        Acarreo aplicado
                      </span>
                      <p className="min-w-0 leading-relaxed">
                        Suma cruda (HLC + externo) antes de normalizar:{" "}
                        <span className="font-mono font-semibold">
                          {ac.antes.años}a {ac.antes.meses}m {ac.antes.dias}d
                        </span>
                        {" → "}
                        <span className="font-mono font-semibold">
                          {ac.despues.años}a {ac.despues.meses}m {ac.despues.dias}d
                        </span>
                        . Reglas: días &gt; 29 → +1 mes (−30); meses &gt; 11 → +1 año (−12).
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {(resultado.detalleCalculo?.reglasAplicadas || []).length > 0 ? (
              <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <summary className="cursor-pointer touch-manipulation select-none font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                  Reglas que aplicó el motor en este cálculo
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-600">
                  {(resultado.detalleCalculo.reglasAplicadas || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              </details>
            ) : null}
            {(() => {
              const det = resultado?.detalleCalculo;
              const fcIso = det?.fechaCorteAplicada || "";
              const fcDdMm = formatDdMmAaaa(fcIso);
              const diasHlc = Number(det?.resumen?.diasHlcFusionados ?? 0);
              const amdHlc =
                det?.amdHlc && typeof det.amdHlc === "object"
                  ? formatoAmdLegible(det.amdHlc)
                  : amdLegibleDesdeDias(diasHlc);
              const amdTotal = formatoAmdLegible({
                años: resultado.años,
                meses: resultado.meses,
                dias: resultado.dias,
              });
              const aplicados = det?.externosConsiderados || [];
              const excl = det?.externosExcluidosPorCorte || [];
              if (aplicados.length > 0) {
                return (
                  <div className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs leading-relaxed text-slate-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Síntesis del cómputo (crédito externo)
                    </p>
                    {aplicados.map((rec, idx) => {
                      const fiDdMm = formatDdMmAaaa(rec?.fecha_impacto || "");
                      const saldoRec = amdLegibleDesdeReconocimiento(rec);
                      return (
                        <p key={`sint-aplica-${idx}`} className="mt-2">
                          Por ser la fecha de cálculo (<span className="font-semibold">{fcDdMm}</span>) igual o posterior a la
                          fecha de implementación del reconocimiento (<span className="font-semibold">{fiDdMm}</span>), se
                          suman al desglose HLC los <span className="font-semibold">{saldoRec}</span> del reconocimiento
                          (años/meses/días), aplicando acarreo si corresponde, resultando la antigüedad total{" "}
                          <span className="font-semibold">{amdTotal}</span>.
                        </p>
                      );
                    })}
                  </div>
                );
              }
              if (excl.length > 0) {
                return (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-3 text-xs leading-relaxed text-amber-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                      Síntesis del cómputo (crédito externo no incorporado)
                    </p>
                    {excl.map((row, idx) => {
                      const fiDdMm = formatDdMmAaaa(row?.detalle?.fecha_impacto || "");
                      const saldoRec = amdLegibleDesdeReconocimiento(row?.detalle || {});
                      return (
                        <p key={`sint-no-${idx}`} className="mt-2">
                          Por ser la fecha de cálculo (<span className="font-semibold">{fcDdMm}</span>) anterior a la fecha
                          de implementación del reconocimiento (<span className="font-semibold">{fiDdMm}</span>),{" "}
                          <span className="font-semibold">no</span> se suma el saldo de{" "}
                          <span className="font-semibold">{saldoRec}</span>. La antigüedad queda entonces en{" "}
                          <span className="font-semibold">{amdHlc}</span> (solo HLC), equivalente al total mostrado:{" "}
                          <span className="font-semibold">{amdTotal}</span>.
                        </p>
                      );
                    })}
                  </div>
                );
              }
              return (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Síntesis del cómputo
                  </p>
                  <p className="mt-2">
                    No interviene reconocimiento de antigüedad externa en este resultado. La antigüedad corresponde al
                    cálculo por HLC: <span className="font-semibold">{amdHlc}</span> (total:{" "}
                    <span className="font-semibold">{amdTotal}</span>).
                  </p>
                </div>
              );
            })()}
            <p className="mt-1 text-xs text-slate-500">
              Corte aplicado: {formatDdMmAaaa(resultado.detalleCalculo?.fechaCorteAplicada || "")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              HLC válidas: {resultado.detalleCalculo?.resumen?.cantidadHlcValidas || 0} · Intervalos fusionados:{" "}
              {resultado.detalleCalculo?.resumen?.cantidadIntervalosFusionados || 0}
            </p>
            {(resultado.detalleCalculo?.hlcConsideradas || []).length > 0 ? (
              <details
                key={`hlc-${detalleKey}`}
                className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 print:break-inside-avoid"
                open={hlcConsideradasCount <= 2}
              >
                <summary className="flex cursor-pointer touch-manipulation list-none items-center gap-2 text-xs font-semibold text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <MarcadorInline className="text-indigo-700">•</MarcadorInline>
                  <span>
                    HLC consideradas ({hlcConsideradasCount})
                    {hlcConsideradasCount > 2 ? (
                      <span className="font-normal text-indigo-600"> — expandir lista</span>
                    ) : null}
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
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
              </details>
            ) : null}
            {(resultado.detalleCalculo?.intervalosFusionados || []).length > 0 ? (
              <details
                key={`fus-${detalleKey}`}
                className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 print:break-inside-avoid"
                open
              >
                <summary className="flex cursor-pointer touch-manipulation list-none items-center gap-2 text-xs font-semibold text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <MarcadorInline className="text-emerald-700">◇</MarcadorInline>
                  <span>Intervalos HLC fusionados</span>
                </summary>
                <TimelineHlcFusionados
                  intervalos={resultado.detalleCalculo.intervalosFusionados}
                  fechaCorteIso={resultado.detalleCalculo?.fechaCorteAplicada || ""}
                />
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.intervalosFusionados || []).map((item, idx) => (
                    <li key={`fused-${idx}`} className="rounded-lg border border-emerald-100 bg-white px-2 py-2">
                      {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin)} · ${item.dias} días · ${diasAAniosMesesDias(
                        item.dias,
                      )}`}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {resultado.detalleCalculo?.amdExternoSumadoRaw ? (
                <p>
                  <span className="font-semibold text-slate-800">Suma crédito externo (A/M/D)</span>:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatoAmdLegible(resultado.detalleCalculo.amdExternoSumadoRaw)}
                  </span>
                  <span className="text-slate-600">
                    {" "}
                    · Equiv. referencial en días (365/30): {resultado.detalleCalculo?.diasExternosAplicados ?? 0} días
                  </span>
                </p>
              ) : (
                <p>
                  <span className="font-semibold text-slate-800">Crédito externo</span>
                  <span className="text-slate-600">: no aplica en este resultado.</span>
                </p>
              )}
              <p className="mt-1 text-slate-600">
                El resultado final en años/meses/días combina HLC + externo y aplica acarreo (días &gt; 29 → mes; meses
                &gt; 11 → año).
              </p>
            </div>
            {(resultado.detalleCalculo?.externosConsiderados || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 print:break-inside-avoid">
                <p className="flex items-center gap-2 text-xs font-semibold text-sky-800">
                  <MarcadorInline className="text-emerald-600">✓</MarcadorInline>
                  Decisión de aplicación del crédito externo
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {(resultado.detalleCalculo?.externosConsiderados || []).map((rec, idx) => (
                    <li key={`ext-ok-${idx}`} className="rounded-lg border border-sky-100 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                          Aplica
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{rec?.normativa || "Sin normativa"}</span>
                      </div>
                      <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                        <div>
                          <dt className="text-slate-500">Aporte A/M/D</dt>
                          <dd className="font-mono font-semibold text-slate-900">
                            {rec?.amd_aportado
                              ? `${rec.amd_aportado.años} / ${rec.amd_aportado.meses} / ${rec.amd_aportado.dias}`
                              : `${Number(rec?.anios || 0)} / ${Number(rec?.meses || 0)} / ${Number(
                                  rec?.dias_desglose_normativo ?? rec?.dias ?? 0,
                                )}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Implementación</dt>
                          <dd className="font-medium text-slate-800">{formatDdMmAaaa(rec?.fecha_impacto || "")}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-slate-500">Equiv. días (referencia 365/30)</dt>
                          <dd className="font-medium text-slate-800">
                            {rec?.dias_netos_aplicados ?? rec?.dias_reconocidos ?? 0}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(resultado.detalleCalculo?.externosExcluidosPorCorte || []).length > 0 ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 print:break-inside-avoid">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <MarcadorInline className="text-amber-700">!</MarcadorInline>
                  Crédito externo no aplicado por fecha
                </p>
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

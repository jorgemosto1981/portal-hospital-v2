import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import {
  TIPOS_EVENTO_CALENDARIO,
  colorClassPorTipoEvento,
} from "../../constants/calendarioInstitucional.js";
import {
  buildIndiceEventosCalendario,
  eliminarEventoCalendarioInstitucional,
  guardarEventoCalendarioInstitucional,
  normalizarYmdCalendario,
  resolverEventoEnIndice,
  esFinDeSemanaYmd,
  subscribeEventosCalendarioInstitucional,
} from "../../services/calendarioInstitucionalService.js";

/** Domingo primero: D L M M J V S */
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function ymdFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Celdas del mes (null = padding). */
function celdasMes(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = first.getUTCDay();
  const cells = [];
  for (let i = 0; i < start; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(ymdFromParts(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarioConfig() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [diaModal, setDiaModal] = useState(null);
  const [tipo, setTipo] = useState("feriado");
  const [multiplicador, setMultiplicador] = useState(1);
  const [descripcion, setDescripcion] = useState("");
  const [anual, setAnual] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeEventosCalendarioInstitucional((next) => {
      setDocs(next);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const indice = useMemo(() => buildIndiceEventosCalendario(docs), [docs]);

  const celdas = useMemo(() => celdasMes(year, month), [year, month]);

  const abrirDia = useCallback(
    (ymd) => {
      const n = normalizarYmdCalendario(ymd);
      if (!n) return;
      const ev = resolverEventoEnIndice(n, indice);
      setDiaModal(n);
      setTipo(ev?.tipo || "feriado");
      setMultiplicador(ev?.multiplicador ?? 1);
      setDescripcion(ev?.descripcion || "");
      setAnual(ev?.anual === true);
      setError("");
    },
    [indice],
  );

  const cerrarModal = () => {
    setDiaModal(null);
    setError("");
  };

  const onGuardar = async () => {
    if (!diaModal) return;
    setGuardando(true);
    setError("");
    try {
      await guardarEventoCalendarioInstitucional(diaModal, {
        tipo,
        descripcion,
        multiplicador: Number(multiplicador),
        anual,
      });
      cerrarModal();
    } catch (e) {
      setError(e?.message || "No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
    }
  };

  const onEliminar = async () => {
    if (!diaModal) return;
    setGuardando(true);
    setError("");
    try {
      await eliminarEventoCalendarioInstitucional(diaModal);
      cerrarModal();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar.");
    } finally {
      setGuardando(false);
    }
  };

  const mesLabel = new Date(year, month - 1, 1).toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card>
          <h1 className="text-xl font-semibold text-slate-900">Calendario institucional</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fuente única de feriados, asuetos y multiplicadores. Los días marcados no cuentan como hábiles
            para licencias y saldos.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Año
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Mes
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleString("es-AR", { month: "long" })}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm font-medium capitalize text-slate-800">{mesLabel}</span>
            {loading ? <span className="text-xs text-slate-500">Sincronizando…</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-6 rounded bg-slate-200" />
              Fin de semana (no hábil)
            </span>
            {TIPOS_EVENTO_CALENDARIO.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1">
                <span className={`inline-block h-3 w-6 rounded ${t.colorClass}`} />
                {t.label}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-600">
            {DIAS_SEMANA.map((d, i) => (
              <div key={`dow-h-${i}`} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {celdas.map((ymd, idx) => {
              if (!ymd) {
                return <div key={`pad-${idx}`} className="min-h-[3rem] rounded bg-slate-50/50" />;
              }
              const ev = resolverEventoEnIndice(ymd, indice);
              const finde = esFinDeSemanaYmd(ymd);
              const color = ev
                ? colorClassPorTipoEvento(ev.tipo)
                : finde
                  ? "bg-slate-200/80 text-slate-600 hover:bg-slate-300/80"
                  : "bg-white hover:bg-slate-50";
              const dayNum = Number(ymd.slice(8, 10));
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => abrirDia(ymd)}
                  className={`min-h-[3rem] rounded border border-slate-200 text-sm font-medium text-slate-800 ${color}`}
                  title={ev?.descripcion || ymd}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {diaModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cal-modal-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h2 id="cal-modal-title" className="text-lg font-semibold text-slate-900">
              Evento — {diaModal}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Tipo
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  {TIPOS_EVENTO_CALENDARIO.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Multiplicador
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.1}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                  value={multiplicador}
                  onChange={(e) => setMultiplicador(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Descripción
                <input
                  type="text"
                  maxLength={500}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={anual} onChange={(e) => setAnual(e.target.checked)} />
                Repetir cada año (mismo mes y día del id guardado)
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                onClick={cerrarModal}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                onClick={onEliminar}
                disabled={guardando}
              >
                Quitar marca
              </button>
              <button
                type="button"
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                onClick={onGuardar}
                disabled={guardando}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

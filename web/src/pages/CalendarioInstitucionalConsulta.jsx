import { useEffect, useMemo, useState } from "react";

import Card from "../components/ui/Card.jsx";
import { CalendarioMesGrilla, LeyendaCalendarioInstitucional } from "../features/calendario/CalendarioMesGrilla.jsx";
import {
  labelMesLargo,
  mesActualBa,
  sumarMeses,
  ventanaMesesConsulta,
} from "../features/calendario/calendarioMesUi.js";
import {
  buildIndiceEventosCalendario,
  subscribeEventosCalendarioInstitucional,
} from "../services/calendarioInstitucionalService.js";

/**
 * Consulta solo lectura — menú rol usuario.
 * Navegación: 5 meses (hoy−2 … hoy+2).
 */
export default function CalendarioInstitucionalConsulta() {
  const ancla = useMemo(() => mesActualBa(), []);
  const [offset, setOffset] = useState(0);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { year, month } = useMemo(
    () => sumarMeses(ancla.year, ancla.month, offset),
    [ancla.month, ancla.year, offset],
  );

  const botonesMes = useMemo(
    () => ventanaMesesConsulta(ancla.year, ancla.month),
    [ancla.month, ancla.year],
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = subscribeEventosCalendarioInstitucional(
      (next) => {
        setDocs(next);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "No se pudo cargar el calendario.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const indice = useMemo(() => buildIndiceEventosCalendario(docs), [docs]);
  const mesLabel = labelMesLargo(year, month);

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card>
          <h1 className="text-xl font-semibold text-slate-900">Calendario institucional</h1>
          <p className="mt-1 text-base text-slate-600">
            Consulta de feriados, asuetos y días institucionales. Solo lectura.
          </p>

          <div
            className="mt-4 grid grid-cols-5 gap-1.5"
            role="group"
            aria-label="Elegir mes"
          >
            {botonesMes.map((b) => {
              const selected = b.offset === offset;
              return (
                <button
                  key={b.offset}
                  type="button"
                  onClick={() => setOffset(b.offset)}
                  className={[
                    "min-h-[44px] touch-manipulation rounded-lg border px-1 py-2 text-center text-xs font-medium capitalize",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                    selected
                      ? "border-sky-600 bg-sky-600 text-white active:bg-sky-700"
                      : "border-slate-300 bg-white text-slate-800 active:bg-slate-100",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-base font-medium capitalize text-slate-800">{mesLabel}</p>
          {loading ? <p className="mt-1 text-sm text-slate-500">Cargando…</p> : null}
          {error ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4">
            <LeyendaCalendarioInstitucional />
          </div>
        </Card>

        <Card>
          <CalendarioMesGrilla year={year} month={month} indice={indice} />
        </Card>
      </div>
    </div>
  );
}

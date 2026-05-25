import { useEffect, useId } from "react";

import {
  CHECKIN_AYUDA_DOC_VERSION,
  CHECKIN_AYUDA_FLUJO,
  CHECKIN_AYUDA_OBJETIVO,
  CHECKIN_AYUDA_PATRONES,
  CHECKIN_AYUDA_TABS,
  CHECKIN_AYUDA_VALIDACIONES,
  checkinAyudaTabLabel,
} from "./checkinSaldosAyudaRrhh.js";

/**
 * @param {{ open: boolean, onClose: () => void, tabActiva: string, onTabChange: (id: string) => void }}
 */
export function CheckinSaldosAyudaModal({ open, onClose, tabActiva, onTabChange }) {
  const tituloId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[85dvh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={tituloId} className="text-xl font-semibold text-slate-900">
                Información — Check-in de saldos
              </h2>
              <p className="mt-1 text-base text-slate-600">Guía para operadores RRHH</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 touch-manipulation active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Cerrar información"
            >
              ✕
            </button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Secciones">
            {CHECKIN_AYUDA_TABS.map((tab) => {
              const activa = tab.id === tabActiva;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`min-h-11 shrink-0 rounded-lg px-3 text-base font-medium touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    activa ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 active:bg-slate-200"
                  }`}
                  aria-current={activa ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-base text-slate-800">
          {tabActiva === "objetivo" ? <ObjetivoContent /> : null}
          {tabActiva === "flujo" ? <FlujoContent /> : null}
          {tabActiva === "patrones" ? <PatronesContent /> : null}
          {tabActiva === "validaciones" ? <ValidacionesContent /> : null}
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-lg bg-slate-800 px-4 text-base font-medium text-white touch-manipulation active:bg-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Cerrar
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">
            {checkinAyudaTabLabel(tabActiva)} — v{CHECKIN_AYUDA_DOC_VERSION}
          </p>
        </footer>
      </div>
    </div>
  );
}

function ObjetivoContent() {
  const { titulo, parrafos, lista } = CHECKIN_AYUDA_OBJETIVO;
  return (
    <article className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      {parrafos.map((p) => (
        <p key={p.slice(0, 40)} className="leading-relaxed text-slate-700">
          {p}
        </p>
      ))}
      {lista ? (
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          {lista.map((item) => (
            <li key={item} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function FlujoContent() {
  const { titulo, pasos } = CHECKIN_AYUDA_FLUJO;
  return (
    <article className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      <ol className="space-y-3">
        {pasos.map((s) => (
          <li key={s.orden} className="flex gap-3 leading-relaxed text-slate-700">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
              {s.orden}
            </span>
            <span className="pt-0.5">{s.texto}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function PatronesContent() {
  const { titulo, patrones, notaAnioA } = CHECKIN_AYUDA_PATRONES;
  return (
    <article className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      <p className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm leading-relaxed text-blue-950">
        {notaAnioA}
      </p>
      {patrones.map((p) => (
        <section key={p.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
          <h4 className="text-base font-semibold text-slate-900">{p.nombre}</h4>
          <p className="mt-2 text-slate-700">{p.queCargar}</p>
          <p className="mt-3 text-sm font-semibold text-slate-800">Validaciones en pantalla</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {p.validaciones.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function ValidacionesContent() {
  const { titulo, bloques } = CHECKIN_AYUDA_VALIDACIONES;
  return (
    <article className="space-y-5">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      {bloques.map((b) => (
        <section key={b.titulo}>
          <h4 className="text-base font-semibold text-slate-900">{b.titulo}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {b.items.map((item) => (
              <li key={item.slice(0, 36)} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

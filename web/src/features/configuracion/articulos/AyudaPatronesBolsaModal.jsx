import { useCallback, useEffect, useId } from "react";
import {
  AYUDA_CASOS_BORDE_SALDOS,
  AYUDA_GUIA_PATRONES_BOLSA_SALDO,
  AYUDA_PATRONES_DOC_VERSION,
  AYUDA_PATRONES_SCHEMA_VERSION,
  AYUDA_PATRONES_TABS,
  AYUDA_RESUMEN_RRHH_SALDOS,
  ayudaPatronesTabLabel,
} from "./ayudaPatronesBolsaSaldo.js";
import "./ayudaPatronesBolsaPrint.css";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.tabActiva
 * @param {(id: string) => void} props.onTabChange
 */
export default function AyudaPatronesBolsaModal({ open, onClose, tabActiva, onTabChange }) {
  const tituloId = useId();
  const tabLabel = ayudaPatronesTabLabel(tabActiva);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
      className="ayuda-patrones-overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ayuda-patrones-panel flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[85dvh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={tituloId} className="text-xl font-semibold text-slate-900">
                Ayuda — bolsa de días / horas
              </h2>
              <p className="mt-1 text-base text-slate-600">Patrones de saldo V2.1</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 touch-manipulation active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 ayuda-patrones-no-print"
              aria-label="Cerrar ayuda"
            >
              ✕
            </button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 ayuda-patrones-no-print" aria-label="Secciones de ayuda">
            {AYUDA_PATRONES_TABS.map((tab) => {
              const activa = tab.id === tabActiva;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`min-h-11 shrink-0 rounded-lg px-3 text-base font-medium touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    activa
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-700 active:bg-slate-200"
                  }`}
                  aria-current={activa ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="ayuda-patrones-print-area min-h-0 flex-1 overflow-y-auto px-4 py-4 text-base text-slate-800">
          <div className="ayuda-patrones-print-header hidden border-b border-slate-200 pb-3">
            <p className="text-sm font-semibold text-slate-900">
              Guía de configuración de saldos — Hospital Gral. Alvear
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Pestaña: {tabLabel} · Versión doc {AYUDA_PATRONES_DOC_VERSION} · schema{" "}
              {AYUDA_PATRONES_SCHEMA_VERSION}
            </p>
          </div>

          {tabActiva === "guia" ? <GuiaPatronesContent /> : null}
          {tabActiva === "rrhh" ? <ResumenRrhhContent /> : null}
          {tabActiva === "casos" ? <CasosBordeContent /> : null}
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end ayuda-patrones-no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-base font-medium text-slate-800 touch-manipulation active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"
            >
              Imprimir / guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full rounded-lg bg-slate-800 px-4 text-base font-medium text-white touch-manipulation active:bg-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"
            >
              Cerrar
            </button>
          </div>
          <p className="ayuda-patrones-print-footer mt-2 hidden text-center text-xs text-slate-500">
            {tabLabel} — doc {AYUDA_PATRONES_DOC_VERSION} — Portal Hospital V2
          </p>
        </footer>
      </div>
    </div>
  );
}

function GuiaPatronesContent() {
  const { titulo, intro, patrones } = AYUDA_GUIA_PATRONES_BOLSA_SALDO;
  return (
    <article className="space-y-5">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
        {intro ? <p className="mt-2 leading-relaxed text-slate-700">{intro}</p> : null}
      </div>
      {patrones.map((p) => (
        <section key={p.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
          <h4 className="text-base font-semibold text-slate-900">{p.nombre}</h4>
          <p className="mt-2 text-slate-700">{p.descripcion}</p>
          <ul className="mt-3 space-y-2">
            {p.bullets.map((b) => (
              <li key={b.label} className="leading-relaxed">
                <strong className="font-semibold text-slate-900">{b.label}:</strong> {b.texto}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function ResumenRrhhContent() {
  const { titulo, secciones } = AYUDA_RESUMEN_RRHH_SALDOS;
  return (
    <article className="space-y-5">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      {secciones.map((s) => (
        <section key={s.titulo}>
          <h4 className="text-base font-semibold text-slate-900">{s.titulo}</h4>
          {s.parrafos?.map((p) => (
            <p key={p.slice(0, 32)} className="mt-2 leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          {s.lista ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
              {s.lista.map((item) => (
                <li key={item.slice(0, 32)} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}

function CasosBordeContent() {
  const { titulo, casos } = AYUDA_CASOS_BORDE_SALDOS;
  return (
    <article className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">{titulo}</h3>
      <ul className="space-y-3">
        {casos.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-100 p-3">
            <p className="font-semibold text-slate-900">
              Caso {c.id} — {c.nombre}
            </p>
            <p className="mt-2 text-slate-700">
              <span className="font-medium text-slate-800">Producto:</span> {c.comportamiento}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Técnico:</span> {c.tecnico}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

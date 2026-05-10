import { useEffect, useRef, useState } from "react";

import ContextNote from "./ContextNote.jsx";
import {
  getArticuloPublicableIssueMessages,
  isArticuloReadinessOk,
} from "../../utils/articulos/articuloFormValidation.js";

/**
 * Badge de readiness (`cfgArticuloPublicableSchema`) + panel de mensajes.
 * @param {{ data: Record<string, unknown> }} p
 */
export default function ArticuloFormReadinessBadge({ data }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef(null);
  const listo = isArticuloReadinessOk(data);
  const mensajes = getArticuloPublicableIssueMessages(data);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const onKey = (e) => {
      if (e.key === "Escape") cerrar();
    };
    const onPointer = (e) => {
      const el = wrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) cerrar();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [abierto]);

  return (
    <div ref={wrapRef} className="flex max-w-[min(100%,22rem)] flex-col items-end gap-2">
      <div className="relative flex flex-col items-end">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={`inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm outline-none ring-blue-500 focus-visible:ring-2 ${
            listo
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          aria-expanded={abierto}
          aria-haspopup="dialog"
        >
          <span className="sr-only">{listo ? "Estado: listo para publicar." : "Estado: pendiente."}</span>
          <span aria-hidden>{listo ? "✅" : "⚠️"}</span>
          {listo ? "Listo para publicar" : "Pendiente de completar"}
        </button>

        {abierto && mensajes.length > 0 ? (
          <div
            className="absolute right-0 top-full z-20 mt-1 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl"
            role="dialog"
            aria-label="Requisitos para publicar"
          >
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {mensajes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <ContextNote className="mt-3 text-left">
              Corregí estos puntos o completá catálogos; el botón Publicar se habilita cuando borrador y
              publicable son ambos válidos.
            </ContextNote>
          </div>
        ) : null}
        {abierto && listo ? (
          <div
            className="absolute right-0 top-full z-20 mt-1 w-[min(100vw-2rem,22rem)] rounded-xl border border-emerald-100 bg-emerald-50/90 p-3 text-left text-sm text-emerald-900 shadow-lg"
            role="dialog"
            aria-label="Listo para publicar"
          >
            <p>
              Cumplís los requisitos normativos para publicar. El botón Publicar también exige que el
              borrador sea válido (formato técnico).
            </p>
          </div>
        ) : null}
      </div>

      <ContextNote className="text-right">
        El semáforo solo revisa los requisitos <strong>mínimos para Publicar</strong> (normativa).{" "}
        <strong>Guardar</strong> exige además que el <strong>borrador</strong> pase la validación técnica
        completa (Zod). Abrí el botón para ver el detalle de faltantes.
      </ContextNote>
    </div>
  );
}

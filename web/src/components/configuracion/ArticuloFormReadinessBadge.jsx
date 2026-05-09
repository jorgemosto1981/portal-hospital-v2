import { useState } from "react";

import {
  getArticuloPublicableIssueMessages,
  isArticuloReadinessOk,
} from "../../utils/articulos/articuloFormValidation.js";

/**
 * Badge de readiness (solo `cfgArticuloPublicableSchema`) + panel de mensajes.
 * @param {{ data: Record<string, unknown> }} p
 */
export default function ArticuloFormReadinessBadge({ data }) {
  const [abierto, setAbierto] = useState(false);
  const listo = isArticuloReadinessOk(data);
  const mensajes = getArticuloPublicableIssueMessages(data);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm outline-none ring-blue-500 focus-visible:ring-2 ${
          listo
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
        aria-expanded={abierto}
      >
        <span aria-hidden>{listo ? "✅" : "⚠️"}</span>
        {listo ? "Listo para publicar" : "Pendiente de completar"}
      </button>
      {abierto && mensajes.length > 0 ? (
        <div
          className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl"
          role="region"
          aria-label="Requisitos para publicar"
        >
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {mensajes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {abierto && listo ? (
        <p className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-emerald-100 bg-emerald-50/90 p-3 text-sm text-emerald-900 shadow-lg">
          Cumplís los requisitos normativos para publicar. El botón Publicar también exige que el borrador
          sea válido (formato técnico).
        </p>
      ) : null}
    </div>
  );
}

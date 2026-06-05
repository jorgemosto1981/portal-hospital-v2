import { useState } from "react";

import {
  GESTION_TURNO_AYUDA_MATRIZ,
  GESTION_TURNO_OPCIONES,
} from "./gestionTurnoWizardOpciones.js";

/** @param {string} letraFlujo */
function flujoIdDesdeLetra(letraFlujo) {
  if (letraFlujo === "A") return "cobertura_parcial";
  if (letraFlujo === "B") return "reemplazo";
  return "adicional";
}

/**
 * Paso 1 wizard — elegir A/B/C. No escribe outbox.
 * @param {{
 *   seleccion: string | null;
 *   onSeleccion: (id: string) => void;
 *   onContinuar: () => void;
 *   onCancelar: () => void;
 *   opcionesBloqueadas?: Record<string, string>;
 *   flujosPermitidos?: import("./gestionTurnoWizardOpciones.js").GestionTurnoFlujoId[] | null;
 *   onAbrirAyuda?: () => void;
 * }} props
 */
export default function GestionTurnoWizardPaso1({
  seleccion,
  onSeleccion,
  onContinuar,
  onCancelar,
  opcionesBloqueadas = {},
  flujosPermitidos = null,
  onAbrirAyuda,
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  const opciones = flujosPermitidos?.length
    ? GESTION_TURNO_OPCIONES.filter((op) => flujosPermitidos.includes(op.id))
    : GESTION_TURNO_OPCIONES;

  const ayudaItems = flujosPermitidos?.length
    ? GESTION_TURNO_AYUDA_MATRIZ.filter((item) => flujosPermitidos.includes(
      /** @type {import("./gestionTurnoWizardOpciones.js").GestionTurnoFlujoId} */ (
        flujoIdDesdeLetra(item.flujo)
      ),
    ))
    : GESTION_TURNO_AYUDA_MATRIZ;

  const tituloPregunta = opciones.length === 1
    ? "Registrá horas adicionales para este día"
    : "¿Qué necesitás registrar?";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-slate-900">{tituloPregunta}</p>
        {onAbrirAyuda ? (
          <button
            type="button"
            onClick={onAbrirAyuda}
            className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-bold text-violet-700 active:bg-violet-50"
            title="Ayuda gestión turno A/B/C"
            aria-label="Ayuda gestión turno del día"
          >
            ?
          </button>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Tipo de gestión de turno</legend>
        {opciones.map((op) => {
          const motivoBloqueo = opcionesBloqueadas[op.id];
          const bloqueada = Boolean(motivoBloqueo);
          const activa = !bloqueada && seleccion === op.id;
          return (
            <label
              key={op.id}
              className={`flex min-h-11 touch-manipulation gap-3 rounded-xl border px-3 py-3 ${
                bloqueada
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                  : `cursor-pointer active:bg-slate-50 ${
                    activa
                      ? "border-violet-600 bg-violet-50 ring-2 ring-violet-600/30"
                      : "border-slate-200 bg-white"
                  }`
              }`}
            >
              <input
                type="radio"
                name="gestion-turno-flujo"
                value={op.id}
                checked={activa}
                disabled={bloqueada}
                onChange={() => onSeleccion(op.id)}
                className="mt-1 h-5 w-5 shrink-0 accent-violet-700 disabled:opacity-40"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-violet-800">{op.letra}</span>
                  <span className="text-base font-semibold text-slate-900">{op.titulo}</span>
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">{op.subtitulo}</span>
                {bloqueada ? (
                  <span className="mt-1 block text-xs text-amber-900">{motivoBloqueo}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {ayudaItems.length > 1 ? (
        <details
          open={ayudaAbierta}
          onToggle={(e) => setAyudaAbierta(e.currentTarget.open)}
          className="rounded-xl border border-slate-200 bg-slate-50"
        >
          <summary className="min-h-11 cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              ¿Cuál me conviene?
              <span className="text-xs font-normal text-slate-500">{ayudaAbierta ? "Ocultar" : "Ver guía"}</span>
            </span>
          </summary>
          <ul className="space-y-2 border-t border-slate-200 px-3 py-2 text-sm text-slate-700">
            {ayudaItems.map((item) => (
              <li key={item.flujo}>
                <p>{item.pregunta}</p>
                <p className="mt-0.5 font-medium text-violet-800">→ Flujo {item.flujo}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          disabled={!seleccion}
          onClick={onContinuar}
          className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-violet-700 text-base font-semibold text-white active:bg-violet-800 disabled:opacity-50"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-base text-slate-700 active:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

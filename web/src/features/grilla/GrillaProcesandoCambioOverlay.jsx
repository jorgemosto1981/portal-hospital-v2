/**
 * Bloquea interacción sobre la grilla mientras corre una operación larga (cambio de turno, fichada, etc.).
 * El mensaje visible aparece solo si `mostrarBanner` (retraso en el padre).
 */
export default function GrillaProcesandoCambioOverlay({ mostrarBanner, mensaje = "Procesando cambio en la grilla…" }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center rounded-2xl bg-slate-900/5"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {mostrarBanner ? (
        <div className="mt-14 flex max-w-md items-center gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3 shadow-lg">
          <span
            className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-800">{mensaje}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Feedback atómico para operaciones con base de datos u otro backend:
 * carga, éxito (check verde) o error (texto claro en rojo).
 */
export default function DataOperationFeedback({ status, message, className = "" }) {
  if (!status || status === "idle") {
    return null;
  }
  if (status === "loading") {
    return (
      <div
        className={`flex items-center gap-2 text-slate-500 ${className}`.trim()}
        role="status"
        aria-live="polite"
      >
        <span
          className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
          aria-hidden
        />
        <span className="text-sm leading-snug">{message || "Cargando…"}</span>
      </div>
    );
  }
  if (status === "success") {
    return (
      <div
        className={`flex items-start gap-2 text-emerald-800 ${className}`.trim()}
        role="status"
        aria-live="polite"
      >
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <span className="text-sm font-medium leading-snug">{message}</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <p
        className={`text-sm font-medium leading-relaxed text-red-600 ${className}`.trim()}
        role="alert"
        aria-live="assertive"
      >
        {message}
      </p>
    );
  }
  return null;
}

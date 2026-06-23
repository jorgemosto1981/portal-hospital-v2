import { formatearUltimaSync } from "./grillaSyncGrupoMesDocId.js";

/**
 * @param {{
 *   estado?: string;
 *   sincronizando?: boolean;
 *   ultimoOkAt?: Date | null;
 *   ultimaSyncListado?: string | null;
 *   errorMensaje?: string | null;
 *   listenerError?: string | null;
 *   listadoPendiente?: boolean;
 * }} props
 */
export default function GrillaBadgeSincronizacion({
  estado = "idle",
  sincronizando = false,
  ultimoOkAt = null,
  ultimaSyncListado = null,
  errorMensaje = null,
  listenerError = null,
  listadoPendiente = false,
}) {
  const fecha =
    ultimoOkAt
    || (ultimaSyncListado ? new Date(ultimaSyncListado) : null);
  const fechaLabel = formatearUltimaSync(fecha);

  if (listenerError) {
    return (
      <p className="mt-1 text-xs text-amber-800" role="status">
        Estado de sync no disponible ({listenerError})
      </p>
    );
  }

  if (errorMensaje) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-800" role="alert">
        <span aria-hidden>⚠</span>
        Error al sincronizar: {errorMensaje}
      </p>
    );
  }

  if (sincronizando || estado === "pendiente" || estado === "en_curso" || listadoPendiente) {
    return (
      <p className="mt-1 flex items-center gap-2 text-xs font-medium text-sky-800" role="status">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"
          aria-hidden
        />
        Sincronizando grilla…
      </p>
    );
  }

  if (fechaLabel) {
    return (
      <p className="mt-1 text-xs text-slate-500" role="status">
        Datos actualizados al {fechaLabel}
      </p>
    );
  }

  return null;
}

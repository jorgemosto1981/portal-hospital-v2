import { renglonPrincipalBandeja, renglonTitularDniBandeja } from "./bandejaSolicitudesFormat.js";

/**
 * Resumen compacto del ítem en listas bandeja jefe / RRHH / médicas.
 *
 * El titular va en cuerpo grande porque es el dato que se busca de un vistazo al
 * recorrer la lista; el id del trámite baja a su propio renglón chico, que solo
 * se lee cuando hace falta copiarlo.
 *
 * @param {{
 *   s: Record<string, unknown>,
 *   neutralizarFamilia64?: boolean,
 *   etiquetaClassName?: string,
 *   ocultarEtiquetaEstado?: boolean,
 *   ocultarSolicitudId?: boolean,
 * }} props
 */
export default function BandejaSolicitudResumenFilas({
  s,
  neutralizarFamilia64 = false,
  etiquetaClassName = "mt-1 text-xs font-medium text-slate-700",
  ocultarEtiquetaEstado = false,
  ocultarSolicitudId = false,
}) {
  const solId = ocultarSolicitudId ? "" : String(s?.solicitud_id || "").trim();
  const titularLinea = renglonTitularDniBandeja(s);

  return (
    <>
      <p className="text-[15px] font-semibold leading-snug text-slate-900">
        {renglonPrincipalBandeja(s, { neutralizarFamilia64 })}
      </p>
      {titularLinea ? (
        <p className="mt-1.5 text-base font-medium leading-snug text-slate-800">{titularLinea}</p>
      ) : null}
      {solId ? (
        <p className="mt-0.5 break-all text-xs italic leading-snug text-slate-500">{solId}</p>
      ) : null}
      {s?.etiqueta_estado && !ocultarEtiquetaEstado ? (
        <p className={etiquetaClassName}>{String(s.etiqueta_estado)}</p>
      ) : null}
    </>
  );
}

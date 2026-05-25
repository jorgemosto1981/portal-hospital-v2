import { renglonPrincipalBandeja, renglonTitularDniBandeja } from "./bandejaSolicitudesFormat.js";

/**
 * Resumen compacto del ítem en listas bandeja jefe / RRHH (3 renglones).
 * @param {{ s: Record<string, unknown>, etiquetaClassName?: string }} props
 */
export default function BandejaSolicitudResumenFilas({ s, etiquetaClassName = "mt-1 text-xs font-medium text-slate-700" }) {
  const solId = String(s?.solicitud_id || "").trim();
  const titularLinea = renglonTitularDniBandeja(s);

  return (
    <>
      <p className="text-[15px] font-semibold leading-snug text-slate-900">{renglonPrincipalBandeja(s)}</p>
      {titularLinea || solId ? (
        <p className="mt-1.5 text-xs text-slate-600">
          {titularLinea}
          {solId ? <span className="italic text-slate-500"> ({solId})</span> : null}
        </p>
      ) : null}
      {s?.etiqueta_estado ? <p className={etiquetaClassName}>{String(s.etiqueta_estado)}</p> : null}
    </>
  );
}

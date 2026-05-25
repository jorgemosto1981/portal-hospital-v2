import { filasExpandConValor } from "./bandejaSolicitudExpandDatos.js";

/**
 * Detalle técnico/operativo del ítem (solo datos ya traídos en el listado).
 * @param {{ sel: Record<string, unknown>, variant: 'jefe' | 'rrhh' }} props
 */
export default function BandejaSolicitudExpandDatos({ sel, variant }) {
  const filas = filasExpandConValor(sel, variant);
  if (!filas.length) {
    return <p className="text-sm text-slate-500">Sin datos adicionales en esta página.</p>;
  }

  return (
    <dl className="grid gap-2 text-sm">
      {filas.map(({ key, label, value }) => (
        <div key={key} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:gap-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="break-all font-mono text-[13px] text-slate-800 leading-snug">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Panel de vigencia del dato laboral (HLD), distinto de HLc y HLg. */
export default function LaboralHldVigenciaPanel({ vigenciaPantalla, hldId, modoAvanzado }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dato laboral (HLD)</p>
      <p className="mt-1 text-xs text-slate-600">
        Función real y vínculo de la persona al cargo. Distinto del período de cargo (HLc) y de la asignación al
        grupo (HLg). Al guardar un grupo, las fechas del HLD se alinean con las del formulario.
      </p>
      {vigenciaPantalla ? (
        <p className="mt-1 text-xs font-semibold text-slate-800">{vigenciaPantalla}</p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-amber-800">
          Sin dato laboral (HLD) vigente vinculado a la asignación al grupo.
        </p>
      )}
      {modoAvanzado && hldId ? (
        <p className="mt-1 font-mono text-[11px] text-slate-500">historial_laboral_datos · {hldId}</p>
      ) : null}
    </div>
  );
}


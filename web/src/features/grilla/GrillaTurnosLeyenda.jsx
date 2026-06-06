/**
 * Leyenda única para grillas de turnos (mensual, aprobada, operativa).
 */
export default function GrillaTurnosLeyenda({ className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-1.5 text-[10px] text-slate-500 ${className}`.trim()}
    >
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-green-300" />
        Asignado
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-slate-400" />
        No asignado / Franco
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-slate-200" />
        No laborable
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-slate-200" />
        Fuera tramo HLg
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-fuchsia-300" />
        Licencia/proyección
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border border-slate-400 bg-amber-300" />
        Feriado/asueto
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded border-2 border-orange-400 bg-green-300" />
        Excepcion
      </span>
    </div>
  );
}

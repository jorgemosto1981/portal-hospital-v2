/**
 * Tarjeta período × grupo (calendario licencias).
 * @param {{
 *   titulo: string;
 *   subtituloPeriodo: string;
 *   cerrado?: boolean;
 *   sinDotacion?: boolean;
 *   disabled?: boolean;
 *   onClick: () => void;
 *   variante?: "titular" | "equipo";
 * }} props
 */
export default function GrillaTarjetaGrupoPeriodo({
  titulo,
  subtituloPeriodo,
  cerrado = false,
  sinDotacion = false,
  disabled = false,
  onClick,
  variante = "equipo",
}) {
  const baseTitular =
    "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100";
  const baseEquipo = "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const baseCerrado =
    "border-slate-400 bg-slate-200 text-slate-800 hover:bg-slate-300 ring-1 ring-inset ring-slate-400/50";
  const baseSinDotacion =
    "border-amber-300 bg-amber-50/90 text-amber-950 hover:bg-amber-100 ring-1 ring-inset ring-amber-200/80";

  const estilo =
    cerrado ? baseCerrado : sinDotacion ? baseSinDotacion : variante === "titular" ? baseTitular : baseEquipo;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex min-h-[3.25rem] w-full flex-col justify-center gap-1 rounded-xl border px-3 py-2 text-left text-sm transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        estilo,
      ].join(" ")}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={variante === "titular" ? "font-semibold" : "font-medium"}>{titulo}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {cerrado ? (
            <span className="rounded-md bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Cerrado
            </span>
          ) : sinDotacion ? (
            <span className="rounded-md bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Sin dotación
            </span>
          ) : null}
          <span className="text-xs opacity-80">{subtituloPeriodo}</span>
        </span>
      </div>
      <span
        className={[
          "text-xs font-medium",
          cerrado || sinDotacion ? "visible" : "invisible min-h-[1rem]",
          cerrado ? "text-slate-700" : sinDotacion ? "text-amber-800" : "text-slate-700",
        ].join(" ")}
        aria-hidden={!cerrado && !sinDotacion}
      >
        {cerrado
          ? "Período cerrado · solo lectura"
          : "Sin dotación · licencias del período anterior conservadas"}
      </span>
    </button>
  );
}

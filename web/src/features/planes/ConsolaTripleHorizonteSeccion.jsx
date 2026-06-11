/**
 * Columna M−1 / M / M+1: acordeón bajo breakpoint lg; siempre expandida en escritorio.
 */
export default function ConsolaTripleHorizonteSeccion({
  idx,
  tituloHorizonte,
  subtituloMes,
  abierto,
  onToggle,
  children,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left lg:pointer-events-none lg:cursor-default"
        onClick={() => onToggle(idx)}
        aria-expanded={abierto}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {tituloHorizonte}
          </p>
          <p className="text-sm font-medium text-slate-900">{subtituloMes}</p>
        </div>
        <span className="mt-0.5 shrink-0 text-slate-400 lg:hidden" aria-hidden>
          {abierto ? "▾" : "▸"}
        </span>
      </button>
      <div className={`mt-2 space-y-2 ${abierto ? "block" : "hidden"} lg:block`}>{children}</div>
    </section>
  );
}

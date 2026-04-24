/**
 * Fila de lista estilo app móvil: icono izquierda, contenido, chevron derecha.
 */
export default function ListItem({
  icon,
  title,
  subtitle,
  onClick,
  className = "",
}) {
  const inner = (
    <>
      {icon ? (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center text-slate-500">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
        ) : null}
      </span>
      <span className="shrink-0 pl-2 text-slate-400" aria-hidden>
        ›
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          "flex w-full min-h-12 items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left shadow-sm transition-transform active:scale-95 " +
          className
        }
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={
        "flex w-full min-h-12 items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm " +
        className
      }
    >
      {inner}
    </div>
  );
}

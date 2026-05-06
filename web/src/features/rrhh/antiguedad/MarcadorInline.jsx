/** Marcador tipográfico pequeño (evita SVG que sin tamaño explícito se ven enormes). */
export function MarcadorInline({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center text-[11px] font-semibold leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {children}
    </span>
  );
}

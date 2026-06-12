import {
  clasesBadgeEstadoFichadaJefe,
  etiquetaEstadoFichadaJefe,
  simboloEstadoFichadaJefe,
} from "./grillaFichadaEstadoJefeDisplay.js";

/**
 * @param {{
 *   estado: string;
 *   tooltip?: string;
 *   className?: string;
 *   compacto?: boolean;
 * }} props
 */
export default function GrillaFichadaEstadoJefeBadge({
  estado,
  tooltip = "",
  className = "",
  compacto = false,
}) {
  const simbolo = simboloEstadoFichadaJefe(estado);
  if (!simbolo) return null;
  const title = tooltip || etiquetaEstadoFichadaJefe(estado) || "";
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded ring-1 font-bold leading-none",
        compacto ? "h-3 min-w-[0.75rem] px-0.5 text-[7px]" : "h-4 min-w-[1rem] px-1 text-[8px]",
        clasesBadgeEstadoFichadaJefe(estado),
        className,
      ].join(" ")}
      title={title}
      aria-label={title}
    >
      {simbolo}
    </span>
  );
}

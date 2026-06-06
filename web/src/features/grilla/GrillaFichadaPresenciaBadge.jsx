import { etiquetaFichadaPresencia, titleFichadaPresencia } from "./grillaFichadaPresenciaDisplay.js";

/**
 * US-15 — indicador presente/ausente en celda (jefe / RRHH sin horarios).
 * @param {{ presencia: 'presente'|'ausente'|null|undefined; className?: string; compacto?: boolean }} props
 */
export default function GrillaFichadaPresenciaBadge({ presencia, className = "", compacto = false }) {
  const etiqueta = etiquetaFichadaPresencia(presencia);
  if (!etiqueta) return null;
  const title = titleFichadaPresencia(presencia);
  const esPresente = presencia === "presente";
  const color = esPresente ? "bg-emerald-800/90" : "bg-rose-800/90";

  return (
    <span
      className={[
        "rounded font-bold leading-tight text-white tabular-nums",
        compacto ? "px-0.5 text-[6px]" : "px-1 text-[7px]",
        color,
        className,
      ].join(" ")}
      title={title || undefined}
      aria-label={title || undefined}
    >
      {etiqueta}
    </span>
  );
}

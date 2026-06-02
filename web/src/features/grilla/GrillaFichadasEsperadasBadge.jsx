import { etiquetaFichadasEsperadas, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";

/**
 * Indicador compacto de fichadas esperadas en celda de grilla.
 * @param {{ valor: number|null, className?: string }} props
 */
export default function GrillaFichadasEsperadasBadge({ valor, className = "" }) {
  const etiqueta = etiquetaFichadasEsperadas(valor);
  if (!etiqueta) return null;
  return (
    <span
      className={`rounded bg-indigo-900/90 px-0.5 text-[6px] font-bold leading-tight text-white tabular-nums ${className}`.trim()}
      title={titleFichadasEsperadas(valor) || undefined}
    >
      {etiqueta}
    </span>
  );
}

import { etiquetaFichadasEsperadas, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";

/**
 * Indicador compacto de fichadas esperadas en celda de grilla.
 * @param {{ valor: number|null, className?: string; preview?: boolean }} props
 */
export default function GrillaFichadasEsperadasBadge({ valor, className = "", preview = false }) {
  const etiqueta = etiquetaFichadasEsperadas(valor);
  if (!etiqueta) return null;
  const title = preview
    ? "Fichadas esperadas (vista previa — aplicar cambios)"
    : titleFichadasEsperadas(valor);
  return (
    <span
      className={`rounded bg-indigo-900/90 px-0.5 text-[6px] font-bold leading-tight text-white tabular-nums ${className}`.trim()}
      title={title || undefined}
    >
      {preview ? `${etiqueta}*` : etiqueta}
    </span>
  );
}

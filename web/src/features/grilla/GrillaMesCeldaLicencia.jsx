import { useState } from "react";

import { lineasTooltipCelda, estiloVisualCelda } from "./grillaMesCellUtils.js";

/**
 * Celda clickeable con tooltip hover (C4).
 * @param {{
 *   eventos: unknown[];
 *   personaLabel?: string;
 *   dia?: string;
 *   grupoVistaId?: string;
 *   etiquetasGrupo?: Record<string, string>;
 *   disabled?: boolean;
 *   onClick?: () => void;
 *   className?: string;
 *   children: import("react").ReactNode;
 * }} props
 */
export default function GrillaMesCeldaLicencia({
  eventos,
  personaLabel,
  dia,
  grupoVistaId,
  etiquetasGrupo,
  disabled,
  onClick,
  className = "",
  children,
}) {
  const [hover, setHover] = useState(false);
  const tiene = Array.isArray(eventos) && eventos.length > 0;
  const { style, className: visualClass } = estiloVisualCelda(eventos, { grupoVistaId });
  const lines = tiene
    ? lineasTooltipCelda(eventos, { personaLabel, dia, grupoVistaId, etiquetasGrupo })
    : [];

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => tiene && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={[
          "h-full w-full",
          visualClass,
          tiene ? "cursor-pointer hover:ring-2 hover:ring-violet-400 hover:ring-offset-1" : "",
          className,
        ].join(" ")}
        style={style}
        aria-label={lines[0] || undefined}
      >
        {children}
      </button>
      {hover && lines.length > 0 ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-30 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-[10px] leading-relaxed text-slate-100 shadow-xl"
        >
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

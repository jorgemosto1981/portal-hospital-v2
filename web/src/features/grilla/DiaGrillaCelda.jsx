import { memo, useMemo } from "react";

import {
  analiticaCumplimientoDesdeCelda,
  microBadgesAnalitica,
} from "./grillaAnaliticaCumplimientoUi.js";

/**
 * Micro-badges de colisión teoría ↔ fichadas (disciplina + débito).
 *
 * @param {{ celdaVis?: Record<string, unknown> | null; className?: string }} props
 */
function DiaGrillaCelda({ celdaVis, className = "" }) {
  const analitica = useMemo(() => analiticaCumplimientoDesdeCelda(celdaVis), [celdaVis]);
  const badges = useMemo(() => microBadgesAnalitica(analitica), [analitica]);

  if (!badges.disciplina && !badges.debito) return null;

  return (
    <span className={`flex flex-wrap items-center justify-center gap-0.5 leading-none ${className}`.trim()}>
      {badges.disciplina ? (
        <span
          className="rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-600"
          title={badges.titleDisciplina || undefined}
        >
          {badges.disciplina}
        </span>
      ) : null}
      {badges.debito ? (
        <span
          className="rounded border border-rose-200 bg-rose-50/90 px-0.5 text-[9px] font-bold text-rose-700"
          title={badges.titleDebito || undefined}
        >
          {badges.debito}
        </span>
      ) : null}
    </span>
  );
}

export default memo(DiaGrillaCelda);

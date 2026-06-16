import { memo, useMemo } from "react";

import {
  analiticaCumplimientoDesdeCelda,
  microBadgesAnalitica,
} from "./grillaAnaliticaCumplimientoUi.js";

/**
 * Micro-badges de colisión teoría ↔ fichadas (disciplina + débito).
 *
 * @param {{
 *   celdaVis?: Record<string, unknown> | null;
 *   className?: string;
 *   modoRrhh?: boolean;
 * }} props
 */
function DiaGrillaCelda({ celdaVis, className = "", modoRrhh = false }) {
  const analitica = useMemo(() => analiticaCumplimientoDesdeCelda(celdaVis), [celdaVis]);
  const badges = useMemo(
    () => microBadgesAnalitica(analitica, { modoRrhh, celdaVis }),
    [analitica, modoRrhh, celdaVis],
  );

  const chipsDisciplina = useMemo(() => {
    if (badges.disciplinaLista?.length) return badges.disciplinaLista;
    if (badges.disciplina) {
      return [{ label: badges.disciplina, title: badges.titleDisciplina || "" }];
    }
    return [];
  }, [badges]);

  if (chipsDisciplina.length === 0 && !badges.debito && !badges.extras) return null;

  return (
    <span className={`flex flex-wrap items-center justify-center gap-0.5 leading-none ${className}`.trim()}>
      {chipsDisciplina.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          className="rounded border border-rose-200 bg-rose-50/90 px-0.5 text-[9px] font-bold text-rose-700"
          title={chip.title || undefined}
        >
          {chip.label}
        </span>
      ))}
      {badges.debito ? (
        <span
          className="rounded border border-rose-200 bg-rose-50/90 px-0.5 text-[9px] font-bold text-rose-700"
          title={badges.titleDebito || undefined}
        >
          {badges.debito}
        </span>
      ) : null}
      {badges.extras ? (
        <span
          className="rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700"
          title={badges.titleExtras || undefined}
        >
          {badges.extras}
        </span>
      ) : null}
    </span>
  );
}

export default memo(DiaGrillaCelda);

import { useMemo } from "react";

import {
  analiticaCumplimientoDesdeCelda,
  analiticaTieneContenidoVisible,
  lineasAuditoriaCumplimientoRrhh,
  tarjetasAuditoriaCumplimientoJefe,
} from "./grillaAnaliticaCumplimientoUi.js";
import { resumenTeoricoParaAuditoria } from "./grillaAuditoriaModalTecnica.js";

/**
 * @param {{
 *   celdaVis?: Record<string, unknown> | null;
 *   esRrhhLabor?: boolean;
 *   turnoTeorico?: { rda_turno_id?: string; capa_teorica?: Record<string, unknown> } | null;
 *   horariosFichada?: string[];
 * }} props
 */
export default function DiaGrillaAuditoriaCumplimientoHorario({
  celdaVis,
  esRrhhLabor = false,
  turnoTeorico = null,
  horariosFichada = [],
}) {
  const analitica = useMemo(() => analiticaCumplimientoDesdeCelda(celdaVis), [celdaVis]);
  const visible = useMemo(() => analiticaTieneContenidoVisible(analitica), [analitica]);
  const tarjetasJefe = useMemo(() => tarjetasAuditoriaCumplimientoJefe(analitica), [analitica]);
  const teorico = useMemo(
    () => resumenTeoricoParaAuditoria(celdaVis, turnoTeorico),
    [celdaVis, turnoTeorico],
  );
  const lineasRrhh = useMemo(
    () =>
      lineasAuditoriaCumplimientoRrhh(analitica, {
        turnoTeoricoId: teorico.turnoId,
        horarioTeorico: teorico.horario,
        horarioFichada: horariosFichada.join(" · "),
      }),
    [analitica, teorico, horariosFichada],
  );

  if (!visible) return null;

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-800">
        Auditoría de cumplimiento horario
      </h4>

      {esRrhhLabor ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-800">
          {lineasRrhh.map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 space-y-2 text-xs text-slate-800">
          {tarjetasJefe.fueraTurno ? (
            <div className="rounded-md border border-violet-300 bg-violet-100/80 p-2.5">
              <p className="font-semibold text-violet-950">Turno teórico vs fichada</p>
              <p className="mt-1 text-violet-900">{tarjetasJefe.fueraTurno}</p>
            </div>
          ) : null}
          {tarjetasJefe.disciplina ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 p-2.5">
              <p className="font-semibold text-amber-950">Disciplina horaria</p>
              <p className="mt-1 text-amber-900">{tarjetasJefe.disciplina}</p>
            </div>
          ) : null}
          {tarjetasJefe.debito ? (
            <div className="rounded-md border border-rose-200 bg-rose-50/80 p-2.5">
              <p className="font-semibold text-rose-950">Carga horaria contractual</p>
              <p className="mt-1 text-rose-900">{tarjetasJefe.debito}</p>
            </div>
          ) : null}
          {tarjetasJefe.ausencia ? (
            <div className="rounded-md border border-slate-300 bg-slate-100 p-2.5">
              <p className="font-semibold text-slate-900">Asistencia</p>
              <p className="mt-1 text-slate-800">{tarjetasJefe.ausencia}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

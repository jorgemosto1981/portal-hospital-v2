import { useMemo } from "react";



import {

  analiticaCumplimientoDesdeCelda,

  analiticaTieneContenidoVisible,

  debeMostrarAuditoriaCumplimientoRrhh,

  lineasDisciplinaTeoriaVsRealRrhh,

  lineasMargenToleranciaRegimenDesdeAnalitica,

  tarjetasAuditoriaCumplimientoJefe,

} from "./grillaAnaliticaCumplimientoUi.js";

import {

  formatearMarcasCrudasFichada,

  lineasAlertaAuditoriaModal,

  resumenTeoricoParaAuditoria,

} from "./grillaAuditoriaModalTecnica.js";

import { titleFichadaPresencia } from "./grillaFichadaPresenciaDisplay.js";

import { textoHorarioFichadaRealDesdeCelda } from "../../../../shared/utils/grillaFichadaPresencia.js";
import {
  esPresentacionPorPisos,
  filasPresentacionOperativaDesdeCelda,
  lineasDesdePresentacionCompuesto,
} from "./grillaPresentacionCompuestoUi.js";
import GrillaPresentacionCompuestoFilas from "./GrillaPresentacionCompuestoFilas.jsx";



/**

 * @param {{

 *   celdaVis?: Record<string, unknown> | null;

 *   esRrhhLabor?: boolean;

 *   mostrarFichada?: boolean;

 *   turnoTeorico?: { rda_turno_id?: string; capa_teorica?: Record<string, unknown> } | null;

 *   resumenFichada?: { presencia?: string; horarios?: string[] } | null;

 *   desalineacionTeoria?: boolean;

 *   desalineacionTooltip?: string;

 *   onAbrirAyuda?: (termino: string) => void;

 * }} props

 */

export default function DiaGrillaAuditoriaCumplimientoHorario({

  celdaVis,

  esRrhhLabor = false,

  mostrarFichada = false,

  turnoTeorico = null,

  resumenFichada = null,

  desalineacionTeoria = false,

  desalineacionTooltip = "",

  onAbrirAyuda,

}) {

  const analitica = useMemo(() => analiticaCumplimientoDesdeCelda(celdaVis), [celdaVis]);

  const alertasSemanticas = useMemo(() => {

    const raw = celdaVis?.validacion_fichada_dia;

    return Array.isArray(raw?.alertas_semanticas) ? raw.alertas_semanticas : [];

  }, [celdaVis]);

  const ocultarDuplicadoJefe = !esRrhhLabor && (alertasSemanticas.length > 0 || celdaVis?.resuelto_rrhh === true);

  const visibleJefe = useMemo(

    () => !ocultarDuplicadoJefe && analiticaTieneContenidoVisible(analitica),

    [analitica, ocultarDuplicadoJefe],

  );

  const visibleRrhh = useMemo(

    () => debeMostrarAuditoriaCumplimientoRrhh(mostrarFichada, celdaVis, turnoTeorico),

    [mostrarFichada, celdaVis, turnoTeorico],

  );

  const tarjetasJefe = useMemo(() => tarjetasAuditoriaCumplimientoJefe(analitica), [analitica]);

  const teorico = useMemo(

    () => resumenTeoricoParaAuditoria(celdaVis, turnoTeorico),

    [celdaVis, turnoTeorico],

  );

  const presencia = resumenFichada?.presencia;

  const filasPresentacion = useMemo(
    () => filasPresentacionOperativaDesdeCelda(celdaVis),
    [celdaVis],
  );
  const matrizPresentacion = esPresentacionPorPisos(filasPresentacion);

  const horarioReal = useMemo(() => {
    if (matrizPresentacion) {
      return lineasDesdePresentacionCompuesto(filasPresentacion).join(" | ");
    }
    const desdeCelda = textoHorarioFichadaRealDesdeCelda(celdaVis);
    if (desdeCelda) return desdeCelda;
    const lineas = resumenFichada?.horarios;
    if (Array.isArray(lineas) && lineas.length > 0) return lineas.join(" · ");
    return null;
  }, [celdaVis, resumenFichada, matrizPresentacion, filasPresentacion]);

  const lineasDisciplina = useMemo(
    () => lineasDisciplinaTeoriaVsRealRrhh(analitica, { presencia, celdaVis }),
    [analitica, presencia, celdaVis],
  );
  const lineasMargenTolerancia = useMemo(
    () => lineasMargenToleranciaRegimenDesdeAnalitica(analitica),
    [analitica],
  );

  const marcasCrudas = useMemo(() => formatearMarcasCrudasFichada(celdaVis), [celdaVis]);

  const alertasTecnicas = useMemo(

    () =>

      lineasAlertaAuditoriaModal(celdaVis, {

        desalineacionTeoria,

        desalineacionTooltip,

      }),

    [celdaVis, desalineacionTeoria, desalineacionTooltip],

  );



  if (esRrhhLabor) {

    if (!visibleRrhh) return null;



    const tituloPresencia =

      titleFichadaPresencia(presencia) ||

      (horarioReal ? "Presente (fichada)" : "Sin fichada registrada");



    return (

      <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">

        <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-800">

          Auditoría de cumplimiento horario

        </h4>



        <div className="mt-3 grid gap-4 sm:grid-cols-2">

          <section>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Turno teórico</p>

            <dl className="mt-1.5 space-y-1 text-xs">

              <div className="flex gap-2">

                <dt className="shrink-0 font-medium text-slate-500">Turno:</dt>

                <dd className="font-bold text-violet-900">{teorico.turnoId}</dd>

              </div>

              <div className="flex gap-2">

                <dt className="shrink-0 font-medium text-slate-500">Tipo día:</dt>

                <dd className="capitalize text-slate-800">{teorico.tipoDia}</dd>

              </div>

              <div className="flex gap-2">

                <dt className="shrink-0 font-medium text-slate-500">Horario:</dt>

                <dd className="text-slate-800">{teorico.horario}</dd>

              </div>

              <div className="flex gap-2">

                <dt className="shrink-0 font-medium text-slate-500">Fichadas esperadas:</dt>

                <dd className="font-bold text-violet-900">{teorico.fichadasEsperadas}</dd>

              </div>

            </dl>

          </section>



          <section>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fichada real</p>

            <p className="mt-1.5 text-sm font-medium text-slate-900">{tituloPresencia}</p>

            {matrizPresentacion ? (
              <div className="mt-2">
                <GrillaPresentacionCompuestoFilas
                  filas={filasPresentacion}
                  tamano="modal"
                />
              </div>
            ) : horarioReal ? (

              <p className="mt-1 font-mono text-sm text-slate-800">{horarioReal}</p>

            ) : (

              <p className="mt-1 text-xs text-slate-600">Sin tramos de ingreso/egreso en la celda.</p>

            )}

          </section>

        </div>



        {lineasMargenTolerancia.length > 0 ? (
          <section className="mt-4 border-t border-violet-200/80 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Márgenes del régimen
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {lineasMargenTolerancia.join(" • ")}
            </p>
          </section>
        ) : null}



        <section className="mt-4 border-t border-violet-200/80 pt-3">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Incumplimiento</p>

          <ul className="mt-1.5 space-y-1 text-xs text-slate-800">

            {lineasDisciplina.map((linea) => (

              <li key={linea}>{linea}</li>

            ))}

          </ul>

        </section>



        {alertasTecnicas.length > 0 ? (

          <ul className="mt-3 space-y-1.5">

            {alertasTecnicas.map((a) => (

              <li

                key={a.codigo}

                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"

              >

                <p>{a.texto}</p>

                {onAbrirAyuda ? (

                  <button

                    type="button"

                    onClick={() => onAbrirAyuda(a.terminoAyuda)}

                    className="mt-1 text-[11px] font-semibold text-violet-800 underline"

                  >

                    Ver regla en ayuda

                  </button>

                ) : null}

              </li>

            ))}

          </ul>

        ) : null}



        <details className="mt-3 rounded-md border border-violet-100 bg-white/50">

          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-900">

            Marcas crudas del reloj

          </summary>

          <div className="border-t border-violet-100 px-2 pb-2 pt-1">

            {marcasCrudas.length === 0 ? (

              <p className="text-xs text-slate-600">Sin marcas en el día.</p>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[16rem] border-collapse text-left">

                  <thead>

                    <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">

                      <th className="py-1 pr-2">#</th>

                      <th className="py-1 pr-2">Tipo</th>

                      <th className="py-1 pr-2">Ingreso</th>

                      <th className="py-1 pr-2">Egreso</th>

                      <th className="py-1">Hora</th>

                    </tr>

                  </thead>

                  <tbody>

                    {marcasCrudas.map((m) => (

                      <tr key={m.indice} className="border-b border-slate-100 font-mono text-[11px]">

                        <td className="py-1 pr-2">{m.indice}</td>

                        <td className="py-1 pr-2">{m.tipo}</td>

                        <td className="py-1 pr-2">{m.ingreso}</td>

                        <td className="py-1 pr-2">{m.egreso}</td>

                        <td className="py-1">{m.hora}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </details>

      </div>

    );

  }



  if (!visibleJefe) return null;



  return (

    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">

      <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-800">

        Auditoría de cumplimiento horario

      </h4>



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

    </div>

  );

}



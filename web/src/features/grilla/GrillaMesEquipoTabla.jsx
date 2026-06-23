import { useMemo } from "react";
import { buildCellKey } from "../../../../shared/utils/grillaMesNodos/index.js";
import { diasEnMes } from "./grillaMesCellUtils.js";
import {
  claseCeldaAgenteSticky,
  claseHeaderGrillaStickyTop,
  claseHeaderGrillaStickyEsquina,
  claseFondoCeldaCalendarioTitular,
} from "./grillaTurnosVisual.js";
import {
  columnasCalendario,
  institucionalPorDiaEnFilas,
  claseFondoColumna,
} from "./grillaMesEquipoDisplay.js";
import {
  filaGrillaTieneTurnoCompuesto,
  ALTURAS_FILA_GRILLA_EQUIPO_ESTANDAR,
  tablaNecesitaColumnasFichadaAnchas,
  ANCHO_MIN_COL_DIA_FICHADA,
  CLASE_TD_DIA_FICHADA,
} from "./grillaPresentacionCompuestoUi.js";
import { diaFueraTramoHlg } from "./grillaMesFilasUtils.js";
import { parsePersonaLabelGrilla } from "./grillaPersonaLabelDisplay.js";
import GrillaDiaCelda from "./GrillaDiaCelda.jsx";

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   filas: Array<Record<string, unknown>>;
 *   grupoSeleccionado?: string;
 *   etiquetasGrupo?: Record<string, string>;
 *   gsoPermiteEscritura?: boolean;
 *   gsoSoloLecturaMotivo?: string | null;
 *   opsOutboxGrupo?: Array<Record<string, unknown>>;
 *   periodoOutbox?: string;
 *   modoFichada?: "rrhh" | "jefe" | null;
 *   materializacionGrupoReciente?: boolean;
 *   onCeldaClick: (payload: {
 *     dia: string; fechaYmd: string; personaId: string; hlgId?: string; filaId?: string;
 *     eventos: unknown[];
 *     personaLabel?: string; grupoLabel?: string;
 *     turnoTeorico?: { rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> };
 *     grupoTrabajoId?: string;
 *     celdaVis?: Record<string, unknown>;
 *     incompletoPlan?: boolean;
 *     desalineacionTeoria?: boolean;
 *     desalineacionTooltip?: string;
 *     vigenteHasta?: string | null;
 *   }) => void;
 * }} props
 */
export default function GrillaMesEquipoTabla({
  anio,
  mes,
  filas,
  grupoSeleccionado,
  etiquetasGrupo = {},
  gsoPermiteEscritura = true,
  gsoSoloLecturaMotivo = null,
  opsOutboxGrupo: _opsOutboxGrupo = [],
  periodoOutbox: _periodoOutbox = "",
  modoFichada = null,
  materializacionGrupoReciente = false,
  onCeldaClick,
}) {
  const totalDias = diasEnMes(anio, mes);
  const columnas = columnasCalendario(anio, mes);
  const institucionalPorDia = institucionalPorDiaEnFilas(filas, totalDias);
  const columnasFichadaAnchas = useMemo(
    () => tablaNecesitaColumnasFichadaAnchas(filas, modoFichada),
    [filas, modoFichada],
  );
  const { alturaFila, alturaChip, uniformarChipPlanificado } = ALTURAS_FILA_GRILLA_EQUIPO_ESTANDAR;
  const claseAnchoColDia = columnasFichadaAnchas ? ANCHO_MIN_COL_DIA_FICHADA : "min-w-[2.5rem]";

  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-[10px] [&_thead_th]:bg-clip-padding">
        <thead>
          <tr>
            <th className={`${claseHeaderGrillaStickyEsquina(0)} h-9 border-b`} />
            {columnas.map((c) => (
              <th
                key={`ds-${c.dia}`}
                className={`${claseAnchoColDia} h-9 ${claseHeaderGrillaStickyTop(0)} ${claseFondoColumna({
                  esFinde: c.esFinde,
                  esFeriado: Boolean(institucionalPorDia[c.dia]),
                })}`}
              >
                {c.letra}
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${claseHeaderGrillaStickyEsquina(1)} h-9 border-b px-2 py-1 text-left text-xs font-semibold text-slate-800`}>
              Persona
            </th>
            {columnas.map((c) => (
              <th
                key={c.dia}
                className={`${claseAnchoColDia} h-9 ${claseHeaderGrillaStickyTop(1)} ${claseFondoColumna({
                  esFinde: c.esFinde,
                  esFeriado: Boolean(institucionalPorDia[c.dia]),
                })}`}
              >
                <span className="text-[11px] font-bold">{c.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td
                colSpan={totalDias + 1}
                className="border border-slate-300 px-3 py-6 text-center text-sm text-slate-500"
              >
                Sin datos. Elegí vista y período y pulsá Cargar.
              </td>
            </tr>
          ) : (
            filas.map((fila) => {
              const filaId = String(fila.fila_id || fila.persona_id || "");
              const personaLabel = String(fila.persona_label || fila.persona_id || "");
              const personaLineas = parsePersonaLabelGrilla(personaLabel);
              const hlgIdFila = String(fila.hlg_id || "").trim() || undefined;
              const filaCompuesta = filaGrillaTieneTurnoCompuesto(fila);
              return (
                <tr key={filaId} className={`${alturaFila} align-middle`}>
                  <td className={claseCeldaAgenteSticky()}>
                    <span className="block leading-tight text-slate-800">
                      <span className="block truncate text-[10px] font-semibold md:text-[11px]">
                        {personaLineas.linea1 || personaLabel}
                      </span>
                      {personaLineas.linea2 ? (
                        <span className="mt-0.5 block truncate text-[9px] font-medium text-slate-600 tabular-nums">
                          {personaLineas.linea2}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {columnas.map((col) => {
                    const dia = col.dia;
                    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                    const fueraTramo = diaFueraTramoHlg(dias, dia);
                    const tipoInstCol = institucionalPorDia[dia];

                    if (fueraTramo) {
                      const claseTdFuera = columnasFichadaAnchas
                        ? `${claseFondoCeldaCalendarioTitular({ sinAsignacionGrupo: true })} ${CLASE_TD_DIA_FICHADA}`
                        : `${claseFondoCeldaCalendarioTitular({ sinAsignacionGrupo: true })} px-0.5 py-0.5 align-middle`;
                      return (
                        <td key={dia} className={claseTdFuera}>
                          <div
                            className={`mx-auto w-full max-w-none ${alturaChip}`}
                            aria-hidden="true"
                            title="No efectivo en este tramo"
                          />
                        </td>
                      );
                    }

                    const cell = dias[dia] || {};
                    const cellGdt = cell.grupo_de_trabajo_id || null;
                    const esOtroGrupo = grupoSeleccionado && cellGdt && cellGdt !== grupoSeleccionado;

                    if (esOtroGrupo) {
                      const otroLabel = cell.etiqueta_grupo_corta || cellGdt;
                      const corta = otroLabel.length > 5 ? otroLabel.slice(0, 4) + "…" : otroLabel;
                      return (
                        <td
                          key={dia}
                          className={
                            columnasFichadaAnchas
                              ? `border border-slate-300 bg-slate-100 ${CLASE_TD_DIA_FICHADA}`
                              : "border border-slate-300 bg-slate-100 p-0 align-middle"
                          }
                        >
                          <div
                            className={`mx-auto flex w-full max-w-none items-center justify-center ${alturaChip}`}
                            title={`Asignado a ${otroLabel}`}
                          >
                            <span className="text-[7px] text-slate-400">{corta}</span>
                          </div>
                        </td>
                      );
                    }

                    const fechaYmd = `${anio}-${String(mes).padStart(2, "0")}-${dia}`;
                    const personaIdFila = String(fila.persona_id || "");
                    const filaMaterializoLazy =
                      fila.materializado_lazy === true || materializacionGrupoReciente === true;
                    const gdtCelda = grupoSeleccionado || cellGdt || "";
                    const cellKey = buildCellKey({
                      gdt: gdtCelda,
                      persona_id: personaIdFila,
                      fecha_ymd: fechaYmd,
                    });

                    return (
                      <GrillaDiaCelda
                        key={dia}
                        cellKey={cellKey}
                        grupoTrabajoId={gdtCelda}
                        personaId={personaIdFila}
                        fechaYmd={fechaYmd}
                        cellFallback={cell}
                        dia={dia}
                        filaId={filaId}
                        personaLabel={personaLabel}
                        hlgId={hlgIdFila}
                        vigenteHasta={fila.vigente_hasta}
                        filaCompuesta={filaCompuesta}
                        filaMaterializoLazy={filaMaterializoLazy}
                        colEsFinde={col.esFinde}
                        tipoInstCol={tipoInstCol}
                        grupoSeleccionado={grupoSeleccionado}
                        etiquetasGrupo={etiquetasGrupo}
                        gsoPermiteEscritura={gsoPermiteEscritura}
                        gsoSoloLecturaMotivo={gsoSoloLecturaMotivo}
                        modoFichada={modoFichada}
                        materializacionGrupoReciente={materializacionGrupoReciente}
                        columnasFichadaAnchas={columnasFichadaAnchas}
                        alturaChip={alturaChip}
                        uniformarChipPlanificado={uniformarChipPlanificado}
                        onCeldaClick={onCeldaClick}
                      />
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

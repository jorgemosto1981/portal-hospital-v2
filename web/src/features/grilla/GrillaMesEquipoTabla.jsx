import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import {
  columnasCalendario,
  institucionalPorDiaEnFilas,
  textoHorarioTurno,
  celdaTieneJornadaVis,
  claseFondoColumna,
  varianteCeldaOperativa,
} from "./grillaMesEquipoDisplay.js";
import {
  claseHeaderAgenteSticky,
  claseCeldaAgenteSticky,
  clasesTextoCelda,
  claseFondoCeldaCalendarioTitular,
} from "./grillaTurnosVisual.js";
import GrillaTurnosCeldaChip from "./GrillaTurnosCeldaChip.jsx";
import GrillaFichadasEsperadasBadge from "./GrillaFichadasEsperadasBadge.jsx";
import { fichadasEsperadasDesdeCeldaVis, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";

function contenidoCeldaOperativa({
  tieneLicencia,
  licenciaCod,
  tieneTurno,
  esFranco,
  esNoLaborable,
  turnoText,
  fichadasN,
}) {
  const badge = <GrillaFichadasEsperadasBadge valor={fichadasN} className="mt-px" />;
  if (tieneLicencia && (tieneTurno || esFranco || esNoLaborable)) {
    return (
      <span className="flex w-full flex-col items-center justify-center leading-none">
        <span className={clasesTextoCelda(turnoText || (esNoLaborable ? "NL" : "F"))}>{turnoText || (esNoLaborable ? "NL" : "F")}</span>
        <span className="mt-0.5 flex flex-col items-center gap-px">
          {badge}
          <span className="text-[7px] font-bold text-fuchsia-950">{licenciaCod.slice(0, 4)}</span>
        </span>
      </span>
    );
  }
  if (tieneLicencia) {
    return (
      <span className="flex flex-col items-center">
        <span className={clasesTextoCelda(licenciaCod)}>{licenciaCod.slice(0, 4)}</span>
        {badge}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center justify-center leading-none">
      <span className={clasesTextoCelda(turnoText)}>{turnoText}</span>
      {badge}
    </span>
  );
}

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   filas: Array<Record<string, unknown>>;
 *   grupoSeleccionado?: string;
 *   etiquetasGrupo?: Record<string, string>;
 *   onCeldaClick: (payload: {
 *     dia: string; fechaYmd: string; personaId: string; eventos: unknown[];
 *     personaLabel?: string; grupoLabel?: string;
 *     turnoTeorico?: { rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> };
 *   }) => void;
 * }} props
 */
export default function GrillaMesEquipoTabla({
  anio,
  mes,
  filas,
  grupoSeleccionado,
  etiquetasGrupo = {},
  onCeldaClick,
}) {
  const totalDias = diasEnMes(anio, mes);
  const columnas = columnasCalendario(anio, mes);
  const institucionalPorDia = institucionalPorDiaEnFilas(filas, totalDias);

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-[10px]">
        <thead>
          <tr>
            <th className={`${claseHeaderAgenteSticky()} h-9 border-b`} />
            {columnas.map((c) => (
              <th
                key={`ds-${c.dia}`}
                className={`min-w-[2.5rem] h-9 ${claseFondoColumna({
                  esFinde: c.esFinde,
                  esFeriado: Boolean(institucionalPorDia[c.dia]),
                })}`}
              >
                {c.letra}
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${claseHeaderAgenteSticky()} h-9 border-b`}>
              Persona
            </th>
            {columnas.map((c) => (
              <th
                key={c.dia}
                className={`min-w-[2.5rem] h-9 ${claseFondoColumna({
                  esFinde: c.esFinde,
                  esFeriado: Boolean(institucionalPorDia[c.dia]),
                })}`}
              >
                <span className="text-[10px] font-bold">{c.num}</span>
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
              const personaLabel = String(fila.persona_label || fila.persona_id || "");
              return (
                <tr key={String(fila.persona_id)} className="h-16 align-middle">
                  <td className={claseCeldaAgenteSticky()}>
                    <span className="block truncate text-[11px] font-semibold leading-snug text-slate-800">
                      {personaLabel}
                    </span>
                  </td>
                  {columnas.map((col) => {
                    const dia = col.dia;
                    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                    const cell = dias[dia] || {};
                    const cellGdt = cell.grupo_de_trabajo_id || null;
                    const esOtroGrupo = grupoSeleccionado && cellGdt && cellGdt !== grupoSeleccionado;

                    if (esOtroGrupo) {
                      const otroLabel = cell.etiqueta_grupo_corta || cellGdt;
                      const corta = otroLabel.length > 5 ? otroLabel.slice(0, 4) + "…" : otroLabel;
                      return (
                        <td key={dia} className="border border-slate-300 bg-slate-100 p-0 align-middle">
                          <div
                            className="mx-auto flex h-12 w-14 items-center justify-center"
                            title={`Asignado a ${otroLabel}`}
                          >
                            <span className="text-[7px] text-slate-400">{corta}</span>
                          </div>
                        </td>
                      );
                    }

                    const eventos = cell.eventos;
                    const licenciaCod = etiquetaCelda(eventos);
                    const tieneLicencia = Boolean(licenciaCod);
                    const turnoText = textoHorarioTurno(cell);
                    const jornadaVis = celdaTieneJornadaVis(cell);
                    const tipoDiaVis = String(cell.tipo_dia || "")
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, "_");
                    const esNoLaborable =
                      !jornadaVis &&
                      (tipoDiaVis === "no_laborable" ||
                        tipoDiaVis === "no-laborable" ||
                        turnoText === "NL");
                    const tieneTurno = Boolean(turnoText && turnoText !== "F" && turnoText !== "NL");
                    const esFranco = (cell.es_franco === true || turnoText === "F") && !esNoLaborable;
                    const tipoInstCol = institucionalPorDia[dia];
                    const tipoInstCel = cell.tipo_evento_institucional || tipoInstCol;
                    const esInstitucional = Boolean(
                      tipoInstCol || cell.es_feriado === true || tipoInstCel === "feriado" || tipoInstCel === "asueto",
                    );

                    const tieneDatos =
                      tieneLicencia || tieneTurno || esFranco || esNoLaborable || esInstitucional;
                    const ingreso = cell.rda_ingreso || null;
                    const egreso = cell.rda_egreso || null;
                    const turnoId = cell.rda_turno_id || null;
                    const grupoLabel = cell.etiqueta_grupo_corta || null;

                    const titleParts = [];
                    if (esInstitucional && tipoInstCel) {
                      titleParts.push(
                        tipoInstCel === "feriado" ? "Feriado" : tipoInstCel === "asueto" ? "Asueto" : "Día institucional",
                      );
                    }
                    if (turnoText) titleParts.push(turnoText);
                    if (licenciaCod) titleParts.push(`Licencia: ${licenciaCod}`);
                    const fichadasN = fichadasEsperadasDesdeCeldaVis(cell);
                    const fichadasTitle = titleFichadasEsperadas(fichadasN);
                    if (fichadasTitle) titleParts.push(fichadasTitle);

                    const variant = varianteCeldaOperativa({
                      tieneLicencia,
                      esNoLaborable,
                      esFranco,
                      tieneTurno: tieneTurno || jornadaVis,
                    });

                    return (
                      <td
                        key={dia}
                        className={`${claseFondoCeldaCalendarioTitular({
                          esFinde: col.esFinde,
                          esFeriado: Boolean(tipoInstCol),
                          esNoLaborable,
                          esLaborable: jornadaVis || tieneTurno,
                        })} px-0.5 py-0.5 align-middle`}
                      >
                        <GrillaMesCeldaLicencia
                          eventos={Array.isArray(eventos) ? eventos : []}
                          personaLabel={personaLabel}
                          dia={dia}
                          grupoVistaId={grupoSeleccionado || undefined}
                          etiquetasGrupo={etiquetasGrupo}
                          disabled={!tieneDatos}
                          onClick={() =>
                            tieneDatos &&
                            onCeldaClick({
                              dia,
                              fechaYmd: `${anio}-${String(mes).padStart(2, "0")}-${dia}`,
                              personaId: String(fila.persona_id || ""),
                              eventos: Array.isArray(eventos) ? eventos : [],
                              personaLabel,
                              grupoLabel,
                              turnoTeorico: {
                                rda_turno_id: turnoId || undefined,
                                es_franco: esFranco,
                                capa_teorica: {
                                  tipo_dia: jornadaVis
                                    ? "laborable"
                                    : esNoLaborable
                                      ? "no_laborable"
                                      : esFranco
                                        ? "franco"
                                        : cell.tipo_dia || "laborable",
                                  ingreso,
                                  egreso,
                                  fichadas_esperadas: fichadasN ?? undefined,
                                  es_feriado: esInstitucional,
                                  tipo_evento_institucional: tipoInstCel || undefined,
                                },
                              },
                            })
                          }
                          className="flex w-full items-center justify-center py-0.5"
                          title={titleParts.join(" · ") || undefined}
                        >
                          <GrillaTurnosCeldaChip variant={variant}>
                            {contenidoCeldaOperativa({
                              tieneLicencia,
                              licenciaCod,
                              tieneTurno,
                              esFranco,
                              esNoLaborable,
                              turnoText,
                              fichadasN,
                            })}
                          </GrillaTurnosCeldaChip>
                        </GrillaMesCeldaLicencia>
                      </td>
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

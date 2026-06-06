import { diasEnMes, etiquetaCelda, celdaTieneDesalineacionTeoria } from "./grillaMesCellUtils.js";
import {
  evaluarImputacionExternaCelda,
  evaluarPostPurgeHlgCelda,
} from "./grillaMesGsoHints.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import {
  columnasCalendario,
  institucionalPorDiaEnFilas,
  textoHorarioTurno,
  celdaTieneJornadaVis,
  celdaEsIncompletoPlanVis,
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
import GrillaFichadaPresenciaBadge from "./GrillaFichadaPresenciaBadge.jsx";
import { fichadasEsperadasDesdeCeldaVis, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";
import { fichadaPresenciaDesdeCeldaVis, titleFichadaPresencia } from "./grillaFichadaPresenciaDisplay.js";
import { visualCeldaOutboxPendiente } from "./grillaCeldaOutboxVisual.js";
import { diaFueraTramoHlg } from "./grillaMesFilasUtils.js";

function contenidoCeldaOperativa({
  tieneLicencia,
  licenciaCod,
  tieneTurno,
  esFranco,
  esNoLaborable,
  turnoText,
  fichadasN,
  fichadaPresencia,
  outboxVisual,
  esIncompletoPlan,
  desalineacionTeoria,
  desalineacionTooltip,
  imputacionExterna,
  imputacionTooltip,
  postPurgeHlg,
  postPurgeTooltip,
}) {
  const fichadasMostrar = outboxVisual?.fichadasPreview ?? fichadasN;
  const alertaTitle = desalineacionTooltip || "Teoría modificada post-licencia";
  const badgeAlerta = desalineacionTeoria ? (
    <span
      className="text-[8px] font-bold leading-none text-amber-700"
      title={alertaTitle}
      aria-label={alertaTitle}
    >
      ⚠
    </span>
  ) : null;
  const badgeFanOut = imputacionExterna ? (
    <span
      className="text-[8px] font-bold leading-none text-sky-800"
      title={imputacionTooltip || "Licencia gestionada en otro sector"}
      aria-label={imputacionTooltip || "Licencia gestionada en otro sector"}
    >
      🔗
    </span>
  ) : null;
  const badgePostPurge = postPurgeHlg ? (
    <span
      className="text-[8px] font-bold leading-none text-amber-900"
      title={postPurgeTooltip || "HLg inactiva — historial de licencia preservado"}
      aria-label={postPurgeTooltip || "HLg inactiva — historial de licencia preservado"}
    >
      📅
    </span>
  ) : null;
  const filaBadges =
    badgeAlerta || badgeFanOut || badgePostPurge ? (
      <span className="flex items-center justify-center gap-px leading-none">
        {badgeAlerta}
        {badgeFanOut}
        {badgePostPurge}
      </span>
    ) : null;
  const badge = (
    <GrillaFichadasEsperadasBadge
      valor={fichadasMostrar}
      preview={outboxVisual?.fichadasEsPreview === true}
      className="mt-px"
    />
  );
  const badgeFichada = fichadaPresencia ? (
    <GrillaFichadaPresenciaBadge presencia={fichadaPresencia} className="mt-px" compacto />
  ) : null;
  const diffBlock = outboxVisual?.pending && (outboxVisual.diffOut || outboxVisual.diffIn) ? (
    <span className="mt-px text-[6px] leading-tight">
      {outboxVisual.diffOut ? (
        <span className="text-rose-700">− {outboxVisual.diffOut}</span>
      ) : null}
      {outboxVisual.diffOut && outboxVisual.diffIn ? (
        <span className="text-slate-400"> · </span>
      ) : null}
      {outboxVisual.diffIn ? (
        <span className="text-emerald-800">+ {outboxVisual.diffIn}</span>
      ) : null}
    </span>
  ) : null;

  if (outboxVisual?.lineaExtra) {
    return (
      <span className="flex w-full flex-col items-center justify-center leading-none">
        {outboxVisual.lineaBaseMuted ? (
          <span className={`${clasesTextoCelda(outboxVisual.lineaBaseMuted)} opacity-70`}>
            {outboxVisual.lineaBaseMuted}
          </span>
        ) : null}
        <span className={clasesTextoCelda(outboxVisual.lineaExtra)}>{outboxVisual.lineaExtra}</span>
        <span className="mt-0.5 flex flex-col items-center gap-px">
          {badge}
          {badgeFichada}
          {diffBlock}
        </span>
      </span>
    );
  }

  const turnoMostrar = outboxVisual?.turnoText ?? turnoText;
  if (tieneLicencia && (tieneTurno || esFranco || esNoLaborable)) {
    return (
      <span className="flex w-full flex-col items-center justify-center leading-none">
        <span className={clasesTextoCelda(turnoMostrar || (esNoLaborable ? "NL" : "F"))}>
          {turnoMostrar || (esNoLaborable ? "NL" : "F")}
        </span>
        <span className="mt-0.5 flex flex-col items-center gap-px">
          {filaBadges}
          {badge}
          {badgeFichada}
          {diffBlock}
          <span className="text-[7px] font-bold text-fuchsia-950">{licenciaCod.slice(0, 4)}</span>
        </span>
      </span>
    );
  }
  if (tieneLicencia) {
    return (
      <span className="flex flex-col items-center">
        {filaBadges}
        <span className={clasesTextoCelda(licenciaCod)}>{licenciaCod.slice(0, 4)}</span>
        {esIncompletoPlan ? (
          <span className="text-[6px] font-semibold text-rose-800">Plan incompleto</span>
        ) : null}
        {badge}
        {badgeFichada}
      </span>
    );
  }
  if (esIncompletoPlan) {
    return (
      <span className="flex flex-col items-center justify-center leading-none">
        <span className="text-[7px] font-bold leading-tight text-rose-950">Sin turno</span>
        {badge}
        {badgeFichada}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center justify-center leading-none">
      <span className={clasesTextoCelda(turnoMostrar)}>{turnoMostrar}</span>
      <span className="mt-0.5 flex flex-col items-center gap-px">
        {filaBadges}
        {badge}
        {badgeFichada}
        {diffBlock}
      </span>
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
 *   opsOutboxGrupo?: Array<Record<string, unknown>>;
 *   periodoOutbox?: string;
 *   modoFichada?: "rrhh" | "jefe" | null;
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
  opsOutboxGrupo = [],
  periodoOutbox = "",
  modoFichada = null,
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
              const filaId = String(fila.fila_id || fila.persona_id || "");
              const personaLabel = String(fila.persona_label || fila.persona_id || "");
              const hlgIdFila = String(fila.hlg_id || "").trim() || undefined;
              return (
                <tr key={filaId} className="h-16 align-middle">
                  <td className={claseCeldaAgenteSticky()}>
                    <span className="block truncate text-[11px] font-semibold leading-snug text-slate-800">
                      {personaLabel}
                    </span>
                  </td>
                  {columnas.map((col) => {
                    const dia = col.dia;
                    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                    const fueraTramo = diaFueraTramoHlg(dias, dia);
                    const tipoInstCol = institucionalPorDia[dia];

                    if (fueraTramo) {
                      return (
                        <td
                          key={dia}
                          className={`${claseFondoCeldaCalendarioTitular({ sinAsignacionGrupo: true })} px-0.5 py-0.5 align-middle`}
                        >
                          <div
                            className="mx-auto h-12 w-14"
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
                    const fechaYmd = `${anio}-${String(mes).padStart(2, "0")}-${dia}`;
                    const personaIdFila = String(fila.persona_id || "");
                    const outboxVisual = visualCeldaOutboxPendiente({
                      cell,
                      ops: opsOutboxGrupo,
                      personaId: personaIdFila,
                      fechaYmd,
                      grupoId: grupoSeleccionado || cellGdt || "",
                      personaLabels: { [personaIdFila]: personaLabel },
                    });
                    const turnoText = outboxVisual?.turnoText ?? textoHorarioTurno(cell);
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
                    const tipoInstCel = cell.tipo_evento_institucional || tipoInstCol;
                    const esInstitucional = Boolean(
                      tipoInstCol || cell.es_feriado === true || tipoInstCel === "feriado" || tipoInstCel === "asueto",
                    );

                    const esIncompletoPlan = celdaEsIncompletoPlanVis(cell);
                    const desalineacion = celdaTieneDesalineacionTeoria(eventos, cell);
                    const desalineacionTeoria = desalineacion.desalineado;
                    const desalineacionTooltip = desalineacion.tooltip;
                    const imputacion = evaluarImputacionExternaCelda(
                      eventos,
                      grupoSeleccionado,
                      etiquetasGrupo,
                    );
                    const postPurge = evaluarPostPurgeHlgCelda(cell, eventos, {
                      fechaYmd,
                      vigenteHasta: fila.vigente_hasta,
                    });
                    const tieneDatos =
                      tieneLicencia ||
                      tieneTurno ||
                      esFranco ||
                      esNoLaborable ||
                      esInstitucional ||
                      esIncompletoPlan;
                    const puedeOperarTurno = tieneDatos && !esIncompletoPlan;
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
                    if (outboxVisual?.tooltip) titleParts.unshift(outboxVisual.tooltip);
                    if (esIncompletoPlan) {
                      titleParts.push("Laborable sin turno (corregir plan del mes)");
                    }
                    const fichadaPresencia = modoFichada
                      ? fichadaPresenciaDesdeCeldaVis(cell, { esRrhh: modoFichada === "rrhh" })
                      : null;
                    const fichadaTitle = titleFichadaPresencia(fichadaPresencia);
                    if (fichadaTitle) titleParts.push(fichadaTitle);
                    if (desalineacionTeoria && desalineacionTooltip) {
                      titleParts.push(desalineacionTooltip);
                    }
                    if (imputacion.activo && imputacion.tooltip) {
                      titleParts.push(imputacion.tooltip);
                    }
                    if (postPurge.activo && postPurge.tooltip) {
                      titleParts.push(postPurge.tooltip);
                    }

                    const variant = varianteCeldaOperativa({
                      tieneLicencia,
                      esNoLaborable,
                      esFranco,
                      tieneTurno: tieneTurno || jornadaVis,
                      esIncompletoPlan: esIncompletoPlan && !tieneLicencia,
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
                          celdaVis={cell}
                          personaLabel={personaLabel}
                          dia={dia}
                          grupoVistaId={grupoSeleccionado || undefined}
                          etiquetasGrupo={etiquetasGrupo}
                          disabled={!tieneDatos}
                          onClick={() =>
                            tieneDatos &&
                            onCeldaClick({
                              incompletoPlan: esIncompletoPlan,
                              desalineacionTeoria,
                              desalineacionTooltip,
                              celdaVis: cell,
                              puedeOperarTurno,
                              dia,
                              fechaYmd,
                              personaId: String(fila.persona_id || ""),
                              hlgId: hlgIdFila,
                              filaId,
                              eventos: Array.isArray(eventos) ? eventos : [],
                              personaLabel,
                              grupoLabel,
                              grupoTrabajoId: grupoSeleccionado || cellGdt || undefined,
                              vigenteHasta: fila.vigente_hasta,
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
                                  horario_display: cell.rda_horario_display,
                                  tiene_huecos: cell.rda_tiene_huecos,
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
                          <GrillaTurnosCeldaChip
                            variant={variant}
                            className={outboxVisual?.pending ? "ring-2 ring-amber-500 ring-offset-0" : ""}
                          >
                            {contenidoCeldaOperativa({
                              tieneLicencia,
                              licenciaCod,
                              tieneTurno,
                              esFranco,
                              esNoLaborable,
                              turnoText,
                              fichadasN,
                              fichadaPresencia,
                              esIncompletoPlan,
                              outboxVisual,
                              desalineacionTeoria,
                              desalineacionTooltip,
                              imputacionExterna: imputacion.activo,
                              imputacionTooltip: imputacion.tooltip,
                              postPurgeHlg: postPurge.activo,
                              postPurgeTooltip: postPurge.tooltip,
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

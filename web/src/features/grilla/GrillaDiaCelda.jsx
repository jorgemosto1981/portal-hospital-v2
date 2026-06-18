import { memo } from "react";

import { buildCellKey } from "../../../../shared/utils/grillaMesNodos/index.js";
import { celdaAusenteSinMarcasPasada } from "../../../../shared/utils/grillaFichadaPresencia.js";
import { etiquetaCelda, celdaTieneDesalineacionTeoria } from "./grillaMesCellUtils.js";
import {
  evaluarImputacionExternaCelda,
  evaluarLicenciaEnFrancoCelda,
  evaluarPostPurgeHlgCelda,
  evaluarTeoriaPendienteLazyCelda,
} from "./grillaMesGsoHints.js";
import { evaluarSoloLecturaCeldaGso } from "./grillaGsoSoloLectura.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import {
  textoHorarioTurno,
  celdaTieneJornadaVis,
  celdaEsIncompletoPlanVis,
  varianteCeldaOperativa,
} from "./grillaMesEquipoDisplay.js";
import {
  CLASE_MARCO_CELDA_OUTBOX_PENDIENTE,
  claseFondoCeldaCalendarioTitular,
  claseFondoTdJefeSemaforo,
} from "./grillaTurnosVisual.js";
import GrillaTurnosCeldaChip from "./GrillaTurnosCeldaChip.jsx";
import { fichadasEsperadasDesdeCeldaVis } from "./grillaFichadasEsperadasDisplay.js";
import {
  fichadaPresenciaDesdeCeldaVis,
  titleFichadaPresencia,
  textoHorarioFichadaRealDesdeCelda,
} from "./grillaFichadaPresenciaDisplay.js";
import {
  esMatrizPresentacionCompuesta,
  esPresentacionPorPisos,
  filasPresentacionMaterializadaDesdeCelda,
  lineasDesdePresentacionCompuesto,
  CLASE_CHIP_IMPORTANTE_COMPUESTO,
  CLASE_CHIP_ANCHO_FICHADA,
  CLASE_CHIP_ANCHO_CELDA_DIA,
  CLASE_CHIP_MARCO_CELDA_DIA,
  CLASE_TD_DIA_FICHADA,
} from "./grillaPresentacionCompuestoUi.js";
import {
  celdaEsDiaFuturoInstitucional,
  estadoSemaforoPinturaCeldaJefe,
  semaforoFichadaDesdeCelda,
} from "./grillaFichadaEstadoJefeDisplay.js";
import { contenidoCeldaOperativa } from "./grillaMesEquipoCeldaContenido.jsx";
import {
  useGrillaMesCeldaSnapshot,
  useGrillaMesNodosContext,
} from "./useGrillaMesNodos.js";

/**
 * @param {import("./GrillaDiaCelda.jsx").GrillaDiaCeldaViewProps} prev
 * @param {import("./GrillaDiaCelda.jsx").GrillaDiaCeldaViewProps} next
 */
export function grillaDiaCeldaPropsAreEqual(prev, next) {
  if (prev.cellKey !== next.cellKey) return false;
  if (prev.revision !== next.revision) return false;
  if (prev.dia !== next.dia) return false;
  if (prev.modoFichada !== next.modoFichada) return false;
  if (prev.columnasFichadaAnchas !== next.columnasFichadaAnchas) return false;
  if (prev.filaCompuesta !== next.filaCompuesta) return false;
  if (prev.colEsFinde !== next.colEsFinde) return false;
  if (prev.tipoInstCol !== next.tipoInstCol) return false;
  if (prev.grupoSeleccionado !== next.grupoSeleccionado) return false;
  if (prev.gsoPermiteEscritura !== next.gsoPermiteEscritura) return false;
  if (prev.gsoSoloLecturaMotivo !== next.gsoSoloLecturaMotivo) return false;
  if (prev.materializacionGrupoReciente !== next.materializacionGrupoReciente) return false;
  if (prev.filaMaterializoLazy !== next.filaMaterializoLazy) return false;
  if (prev.vigenteHasta !== next.vigenteHasta) return false;
  if (prev.personaLabel !== next.personaLabel) return false;
  if (prev.alturaChip !== next.alturaChip) return false;
  return true;
}

/**
 * @typedef {Object} GrillaDiaCeldaViewProps
 * @property {string} cellKey
 * @property {number} revision
 * @property {Record<string, unknown>} cell
 * @property {ReturnType<import("./grillaCeldaOutboxVisual.js").visualCeldaOutboxPendiente>} outboxVisual
 * @property {string} dia
 * @property {string} fechaYmd
 * @property {string} filaId
 * @property {string} personaId
 * @property {string} personaLabel
 * @property {string} [hlgId]
 * @property {string|null} [vigenteHasta]
 * @property {boolean} filaCompuesta
 * @property {boolean} filaMaterializoLazy
 * @property {boolean} colEsFinde
 * @property {unknown} tipoInstCol
 * @property {string} [grupoSeleccionado]
 * @property {Record<string, string>} etiquetasGrupo
 * @property {boolean} gsoPermiteEscritura
 * @property {string|null} [gsoSoloLecturaMotivo]
 * @property {"rrhh"|"jefe"|null} [modoFichada]
 * @property {boolean} materializacionGrupoReciente
 * @property {boolean} columnasFichadaAnchas
 * @property {string} alturaChip
 * @property {(payload: Record<string, unknown>) => void} onCeldaClick
 */

const GrillaDiaCeldaView = memo(function GrillaDiaCeldaView({
  cellKey,
  revision,
  cell,
  outboxVisual,
  dia,
  fechaYmd,
  filaId,
  personaId,
  personaLabel,
  hlgId,
  vigenteHasta,
  filaCompuesta,
  filaMaterializoLazy,
  colEsFinde,
  tipoInstCol,
  grupoSeleccionado,
  etiquetasGrupo,
  gsoPermiteEscritura,
  gsoSoloLecturaMotivo,
  modoFichada,
  materializacionGrupoReciente,
  columnasFichadaAnchas,
  alturaChip,
  onCeldaClick,
}) {
  void cellKey;
  void revision;

  const cellGdt = cell.grupo_de_trabajo_id || null;
  const eventos = cell.eventos;
  const licenciaCod = etiquetaCelda(eventos);
  const tieneLicencia = Boolean(licenciaCod);
  const esFuturoGris = celdaEsDiaFuturoInstitucional(fechaYmd);

  const filasPresentacion = filasPresentacionMaterializadaDesdeCelda(cell);
  const matrizPresentacionCompuesta = esMatrizPresentacionCompuesta(filasPresentacion);
  const previewOutboxPendiente =
    Boolean(outboxVisual?.pending) && !outboxVisual?.mostrarResultadoFinal;
  const resultadoFinalOutbox = Boolean(outboxVisual?.mostrarResultadoFinal);
  const usaPresentacionPisos =
    !previewOutboxPendiente && esPresentacionPorPisos(filasPresentacion);
  const turnoText = outboxVisual?.turnoText ?? textoHorarioTurno(cell);
  const textoFichadaReal =
    !usaPresentacionPisos && !previewOutboxPendiente
      ? textoHorarioFichadaRealDesdeCelda(cell)
      : "";
  const mostrarFichadaReal =
    !previewOutboxPendiente &&
    !esFuturoGris &&
    (usaPresentacionPisos
      ? filasPresentacion.some(
          (f) =>
            String(f.fichada_label || "").trim() ||
            String(f.badge_label || "").trim(),
        )
      : Boolean(textoFichadaReal));
  const horarioCelda = mostrarFichadaReal ? textoFichadaReal : turnoText;
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
  const imputacion = evaluarImputacionExternaCelda(eventos, grupoSeleccionado, etiquetasGrupo);
  const postPurge = evaluarPostPurgeHlgCelda(cell, eventos, {
    fechaYmd,
    vigenteHasta,
  });
  const teoriaPendiente = evaluarTeoriaPendienteLazyCelda(cell, eventos, {
    fechaYmd,
    vigenteHasta,
    materializadoLazy: filaMaterializoLazy,
    postPurgeActivo: postPurge.activo,
  });
  const licenciaFranco = evaluarLicenciaEnFrancoCelda(cell, eventos);
  const soloLectura = evaluarSoloLecturaCeldaGso({
    gsoPermiteEscritura,
    motivo: gsoSoloLecturaMotivo,
    tieneDatos:
      tieneLicencia ||
      tieneTurno ||
      esFranco ||
      esNoLaborable ||
      esInstitucional ||
      esIncompletoPlan,
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
  if (mostrarFichadaReal) {
    if (usaPresentacionPisos) {
      titleParts.push(lineasDesdePresentacionCompuesto(filasPresentacion).join(" | "));
    } else {
      titleParts.push(textoFichadaReal);
    }
  } else if (turnoText) {
    titleParts.push(turnoText);
  }
  if (licenciaCod) titleParts.push(`Licencia: ${licenciaCod}`);
  const fichadasN = fichadasEsperadasDesdeCeldaVis(cell);
  if (outboxVisual?.tooltip) titleParts.unshift(outboxVisual.tooltip);
  if (esIncompletoPlan) {
    titleParts.push("Laborable sin turno (corregir plan del mes)");
  }
  const semaforoFichada = semaforoFichadaDesdeCelda(cell, { fechaYmd });
  const fichadaPresencia =
    modoFichada === "rrhh" && !esFuturoGris
      ? fichadaPresenciaDesdeCeldaVis(cell, { esRrhh: true })
      : null;
  const fichadaTitle = semaforoFichada
    ? semaforoFichada.tooltip
    : titleFichadaPresencia(fichadaPresencia);
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
  if (teoriaPendiente.activo && teoriaPendiente.tooltip) {
    titleParts.push(teoriaPendiente.tooltip);
  }
  if (licenciaFranco.activo && licenciaFranco.tooltip) {
    titleParts.push(licenciaFranco.tooltip);
  }
  if (soloLectura.activo && soloLectura.tooltip) {
    titleParts.push(soloLectura.tooltip);
  }

  const ausenteSinMarcasPasada = celdaAusenteSinMarcasPasada(cell, fechaYmd);
  const estadoSemaforoCelda = semaforoFichada?.estado
    ? estadoSemaforoPinturaCeldaJefe(semaforoFichada.estado, cell, fechaYmd)
    : null;
  const pintarCeldaSemaforoJefe =
    modoFichada === "jefe" &&
    Boolean(estadoSemaforoCelda) &&
    !esFuturoGris &&
    !usaPresentacionPisos &&
    !previewOutboxPendiente;

  const puedeMostrarChipFichadaReal =
    usaPresentacionPisos ||
    modoFichada === "rrhh" ||
    !estadoSemaforoCelda ||
    estadoSemaforoCelda === "VERDE";

  const tieneLicenciaParaVariant =
    modoFichada === "jefe" && pintarCeldaSemaforoJefe ? false : tieneLicencia;

  const variant =
    usaPresentacionPisos
      ? "vacio"
      : (mostrarFichadaReal && puedeMostrarChipFichadaReal && !tieneLicenciaParaVariant)
        ? "fichadaReal"
        : varianteCeldaOperativa({
            tieneLicencia: tieneLicenciaParaVariant,
            esNoLaborable,
            esFranco,
            tieneTurno: previewOutboxPendiente ? tieneTurno : tieneTurno || jornadaVis,
            esIncompletoPlan: esIncompletoPlan && !tieneLicencia,
            teoriaPendienteLazy: previewOutboxPendiente ? false : teoriaPendiente.activo,
            esFuturoGris,
            estadoSemaforoFichada:
              previewOutboxPendiente || esFuturoGris
                ? null
                : estadoSemaforoPinturaCeldaJefe(semaforoFichada?.estado, cell, fechaYmd),
          });

  const claseTdBase =
    pintarCeldaSemaforoJefe && estadoSemaforoCelda
      ? claseFondoTdJefeSemaforo(estadoSemaforoCelda)
      : claseFondoCeldaCalendarioTitular({
          esFinde: colEsFinde,
          esFeriado: Boolean(tipoInstCol),
          esNoLaborable,
          esFranco,
          esLaborable: previewOutboxPendiente ? tieneTurno : jornadaVis || tieneTurno,
        });
  const claseTdPadding =
    columnasFichadaAnchas && !pintarCeldaSemaforoJefe
      ? CLASE_TD_DIA_FICHADA
      : pintarCeldaSemaforoJefe && estadoSemaforoCelda
        ? "p-0 align-middle"
        : "px-0.5 py-0.5 align-middle";
  const claseTd = [claseTdBase, claseTdPadding].filter(Boolean).join(" ");

  return (
    <td className={claseTd}>
      <GrillaMesCeldaLicencia
        eventos={Array.isArray(eventos) ? eventos : []}
        celdaVis={cell}
        personaLabel={personaLabel}
        dia={dia}
        grupoVistaId={grupoSeleccionado || undefined}
        etiquetasGrupo={etiquetasGrupo}
        disabled={!tieneDatos}
        celdaRellena={pintarCeldaSemaforoJefe}
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
            personaId,
            hlgId,
            filaId,
            eventos: Array.isArray(eventos) ? eventos : [],
            personaLabel,
            grupoLabel,
            grupoTrabajoId: grupoSeleccionado || cellGdt || undefined,
            vigenteHasta,
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
        className={
          pintarCeldaSemaforoJefe
            ? "block w-full p-0"
            : usaPresentacionPisos
              ? "block w-full p-0"
              : "flex w-full items-center justify-center py-0.5"
        }
        title={titleParts.join(" · ") || undefined}
      >
        <GrillaTurnosCeldaChip
          variant={variant}
          rellenoCelda={pintarCeldaSemaforoJefe}
          className={[
            outboxVisual?.pending && !outboxVisual?.mostrarResultadoFinal
              ? CLASE_MARCO_CELDA_OUTBOX_PENDIENTE
              : "",
            columnasFichadaAnchas && !pintarCeldaSemaforoJefe ? CLASE_CHIP_MARCO_CELDA_DIA : "",
            columnasFichadaAnchas ? "!text-[9px]" : "",
            columnasFichadaAnchas && !usaPresentacionPisos ? CLASE_CHIP_ANCHO_CELDA_DIA : "",
            filaCompuesta ? CLASE_CHIP_IMPORTANTE_COMPUESTO : "",
            usaPresentacionPisos ? `${CLASE_CHIP_ANCHO_FICHADA} !p-0` : "",
            usaPresentacionPisos && !matrizPresentacionCompuesta ? CLASE_CHIP_IMPORTANTE_COMPUESTO : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {contenidoCeldaOperativa({
            tieneLicencia,
            licenciaCod,
            tieneTurno,
            esFranco,
            esNoLaborable,
            turnoText: horarioCelda,
            mostrarFichadaReal,
            fichadaPresencia,
            estadoFichadaJefe:
              previewOutboxPendiente
                ? null
                : modoFichada === "jefe" && pintarCeldaSemaforoJefe
                  ? semaforoFichada
                  : tieneLicencia
                    ? null
                    : semaforoFichada,
            esIncompletoPlan,
            outboxVisual,
            desalineacionTeoria,
            desalineacionTooltip,
            imputacionExterna: imputacion.activo,
            imputacionTooltip: imputacion.tooltip,
            postPurgeHlg: postPurge.activo,
            postPurgeTooltip: postPurge.tooltip,
            teoriaPendienteLazy: teoriaPendiente.activo,
            teoriaPendienteTooltip: teoriaPendiente.tooltip,
            licenciaEnFranco: licenciaFranco.activo,
            licenciaEnFrancoTooltip: licenciaFranco.tooltip,
            soloLecturaGrilla: soloLectura.activo,
            soloLecturaTooltip: soloLectura.tooltip,
            celdaVis: cell,
            filasPresentacionCompuesto: usaPresentacionPisos ? filasPresentacion : null,
            matrizPresentacionCompuesta,
            usaPresentacionPisos,
            pisoCompuestoGrande: filaCompuesta || usaPresentacionPisos,
            ocultarMicroAnalitica:
              previewOutboxPendiente ||
              (modoFichada === "jefe" && !ausenteSinMarcasPasada) ||
              esFuturoGris,
            modoFichadaRrhh: modoFichada === "rrhh",
            omitirBadgeSemaforo:
              previewOutboxPendiente ||
              (Boolean(semaforoFichada?.estado)
                && (pintarCeldaSemaforoJefe || modoFichada === "rrhh")),
            soloTeoriaFuturo: esFuturoGris && !tieneLicencia,
            celdaFuturaSinFichada: esFuturoGris,
          })}
        </GrillaTurnosCeldaChip>
      </GrillaMesCeldaLicencia>
    </td>
  );
}, grillaDiaCeldaPropsAreEqual);

/**
 * Celda día memoizada — datos desde `GrillaMesNodoStore` vía contexto.
 * @param {Omit<GrillaDiaCeldaViewProps, "cell"|"revision"|"outboxVisual"> & {
 *   cellKey?: string;
 *   grupoTrabajoId: string;
 *   cellFallback?: Record<string, unknown>;
 * }} props
 */
export default function GrillaDiaCelda({
  cellKey: cellKeyProp,
  grupoTrabajoId,
  personaId,
  fechaYmd,
  cellFallback,
  ...rest
}) {
  const cellKey =
    cellKeyProp ||
    buildCellKey({
      gdt: grupoTrabajoId,
      persona_id: personaId,
      fecha_ymd: fechaYmd,
    });
  const nodosCtx = useGrillaMesNodosContext();
  const snap = useGrillaMesCeldaSnapshot(nodosCtx ? cellKey : "");

  const fromStore = nodosCtx ? snap.cell : null;
  const fallback =
    cellFallback && typeof cellFallback === "object" ? cellFallback : {};
  const cell = nodosCtx
    ? snap.outboxVisual?.mostrarResultadoFinal
      ? fromStore && typeof fromStore === "object" && Object.keys(fromStore).length > 0
        ? fromStore
        : fallback
      : snap.pending
        ? { ...fallback, ...(fromStore && typeof fromStore === "object" ? fromStore : {}) }
        : Object.keys(fallback).length > 0
          ? {
              ...(fromStore && typeof fromStore === "object" ? fromStore : {}),
              ...fallback,
            }
          : fromStore && typeof fromStore === "object"
            ? fromStore
            : {}
    : fallback;
  const revision = nodosCtx ? snap.revision : 0;
  const outboxVisual = nodosCtx ? snap.outboxVisual : null;

  return (
    <GrillaDiaCeldaView
      {...rest}
      cellKey={cellKey}
      revision={revision}
      cell={cell}
      outboxVisual={outboxVisual}
      personaId={personaId}
      fechaYmd={fechaYmd}
    />
  );
}

export { GrillaDiaCeldaView };

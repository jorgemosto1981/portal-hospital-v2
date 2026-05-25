import { useMemo } from "react";
import {
  buildIntegridadLaboral,
  buildTimelineItemsByPersona,
  buildTimelineResumen,
  buildVistaGrupoItems,
  filterTimelineItems,
  filterTimelineItemsAdvanced,
} from "./utils.js";

/**
 * Timeline por persona, vista operativa por grupo e integridad referencial (HLc/HLd/HLg).
 */
export function useLaboralAnalisisOperativa({
  hlcRows,
  hldRows,
  hlgRowsVisibles,
  idxHlc,
  idxHld,
  idxGrupos,
  idxEfectores,
  idxPersonas,
  idxRoles,
  idxFunciones,
  timelinePersonaId,
  timelineFiltro,
  timelineFecha,
  timelineTipoTramo,
  timelineGrupoId,
  timelineEstadoAsignacionId,
  timelineNivelMin,
  timelineNivelMax,
  timelineOnlySinReferencias,
  timelineOnlySolape,
  timelineWarningTipo,
  grupoVistaId,
  grupoVistaFecha,
}) {
  const timelineItemsBase = useMemo(
    () =>
      buildTimelineItemsByPersona({
        personaId: timelinePersonaId,
        hlcRows,
        hldRows,
        hlgRows: hlgRowsVisibles,
        idxHlc,
        idxHld,
        idxGrupos,
        idxEfectores,
        idxPersonas,
        idxRoles,
        idxFunciones,
      }),
    [
      timelinePersonaId,
      hlcRows,
      hldRows,
      hlgRowsVisibles,
      idxHlc,
      idxHld,
      idxGrupos,
      idxEfectores,
      idxPersonas,
      idxRoles,
      idxFunciones,
    ],
  );

  const timelineItems = useMemo(() => {
    const base = filterTimelineItems(timelineItemsBase, {
      filtro: timelineFiltro,
      fecha: timelineFecha,
    });
    return filterTimelineItemsAdvanced(base, {
      tipo: timelineTipoTramo,
      grupoId: timelineGrupoId,
      estadoAsignacionId: timelineEstadoAsignacionId,
      nivelMin: timelineNivelMin,
      nivelMax: timelineNivelMax,
      onlySinReferencias: timelineOnlySinReferencias,
      onlySolape: timelineOnlySolape,
      warningTipo: timelineWarningTipo,
    });
  }, [
    timelineItemsBase,
    timelineFiltro,
    timelineFecha,
    timelineTipoTramo,
    timelineGrupoId,
    timelineEstadoAsignacionId,
    timelineNivelMin,
    timelineNivelMax,
    timelineOnlySinReferencias,
    timelineOnlySolape,
    timelineWarningTipo,
  ]);

  const timelineResumen = useMemo(() => buildTimelineResumen(timelineItemsBase), [timelineItemsBase]);

  const vistaGrupoItems = useMemo(
    () =>
      buildVistaGrupoItems({
        grupoId: grupoVistaId,
        fechaCorte: grupoVistaFecha,
        hlgRows: hlgRowsVisibles,
        idxPersonas,
        idxHld,
        idxHlc,
      }),
    [grupoVistaId, grupoVistaFecha, hlgRowsVisibles, idxPersonas, idxHld, idxHlc],
  );

  const integridad = useMemo(
    () =>
      buildIntegridadLaboral({
        hlcRows,
        hldRows,
        hlgRows: hlgRowsVisibles,
        idxHlc,
        idxHld,
        idxGrupos,
        idxEfectores,
      }),
    [hlcRows, hldRows, hlgRowsVisibles, idxHlc, idxHld, idxGrupos, idxEfectores],
  );

  return {
    timelineItemsBase,
    timelineItems,
    timelineResumen,
    vistaGrupoItems,
    ...integridad,
  };
}

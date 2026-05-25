import { useMemo } from "react";
import { buildLaboralSnapshotActual, buildLaboralSnapshotHistorico } from "./laboralSnapshots.js";

/**
 * Vista operativa de cargos vigentes e históricos para la persona seleccionada.
 */
export function useLaboralSnapshots({
  personaId,
  hlcRows,
  hldRows,
  hlgRowsVisibles,
  idxHld,
  idxFunciones,
  idxEfectores,
  idxGrupos,
  idxRoles,
  idxTipoVinculo,
  idxEscalafon,
  idxAgrupamiento,
  idxCategorias,
}) {
  const snapshotActual = useMemo(
    () =>
      buildLaboralSnapshotActual({
        personaId,
        hlcRows,
        hldRows,
        hlgRowsVisibles,
        idxHld,
        idxFunciones,
        idxEfectores,
        idxGrupos,
        idxRoles,
        idxTipoVinculo,
        idxEscalafon,
        idxAgrupamiento,
        idxCategorias,
      }),
    [
      personaId,
      hlcRows,
      hlgRowsVisibles,
      hldRows,
      idxHld,
      idxFunciones,
      idxEfectores,
      idxGrupos,
      idxRoles,
      idxTipoVinculo,
      idxEscalafon,
      idxAgrupamiento,
      idxCategorias,
    ],
  );

  const snapshotHistorico = useMemo(
    () =>
      buildLaboralSnapshotHistorico({
        personaId,
        hlcRows,
        hldRows,
        hlgRowsVisibles,
        idxHld,
        idxFunciones,
        idxEfectores,
        idxGrupos,
        idxRoles,
        idxTipoVinculo,
        idxEscalafon,
        idxAgrupamiento,
        idxCategorias,
      }),
    [
      personaId,
      hlcRows,
      hldRows,
      hlgRowsVisibles,
      idxHld,
      idxFunciones,
      idxEfectores,
      idxGrupos,
      idxRoles,
      idxTipoVinculo,
      idxEscalafon,
      idxAgrupamiento,
      idxCategorias,
    ],
  );

  return { snapshotActual, snapshotHistorico };
}

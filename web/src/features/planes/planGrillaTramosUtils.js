import { filaKeyAg } from "../grilla/grillaMesFilasUtils.js";
import { derivarCargaSemanalDesdeRegimen } from "../../pages/datos-laborales/utils.js";

/** @param {Array<{ hlg_id?: string, vigente_desde?: string, vigente_hasta?: string }> | null | undefined} agentes */
export function agentesGrillaNecesitanTramos(agentes) {
  return (agentes || []).some((ag) => {
    const hid = String(ag?.hlg_id || "").trim();
    return hid && (!ag.vigente_desde || !ag.vigente_hasta);
  });
}

/**
 * Fallback cliente: tramos HLg desde listarContextoPlanGrupo (planes legacy sin metadata en snapshot).
 * @param {object|null|undefined} grillaAprobada
 * @param {Array<Record<string, unknown>> | null | undefined} personasGrupo
 * @param {Record<string, unknown>} regimenes
 */
export function enriquecerGrillaAprobadaConPersonasGrupo(grillaAprobada, personasGrupo, regimenes = {}) {
  if (!grillaAprobada?.agentes?.length || !personasGrupo?.length) return grillaAprobada;

  const byFila = new Map();
  const byHlg = new Map();
  for (const pg of personasGrupo) {
    const fid = filaKeyAg(pg);
    byFila.set(fid, pg);
    const hid = String(pg.hlg_id || "").trim();
    if (hid) byHlg.set(hid, pg);
  }

  const agentes = grillaAprobada.agentes.map((ag) => {
    if (ag.vigente_desde && ag.vigente_hasta) return ag;
    const fid = filaKeyAg(ag);
    const hid = String(ag.hlg_id || "").trim();
    const pg = byFila.get(fid) || (hid ? byHlg.get(hid) : null);
    if (!pg) return ag;

    const regId = pg.regimen_horario_id || ag.regimen_horario_id;
    const carga = derivarCargaSemanalDesdeRegimen(regimenes?.[regId]);

    return {
      ...ag,
      fila_id: ag.fila_id || fid,
      vigente_desde: pg.vigente_desde,
      vigente_hasta: pg.vigente_hasta,
      carga_horaria_semanal: carga,
      regimen_horario_id: regId || ag.regimen_horario_id,
    };
  });

  return { ...grillaAprobada, agentes };
}

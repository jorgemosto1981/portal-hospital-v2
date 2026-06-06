/**
 * Materialización puntual de un día (F-UX.3 gate).
 */
import { callMaterializarTurnoTeoricoDia, callObtenerCapaTeoricaDia } from "./callables.js";
import { assertGrupoTrabajoId } from "../features/grilla/grillaGrupoUtils.js";

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId
 */
export async function materializarCeldaDia(personaId, fechaYmd, grupoTrabajoId) {
  const gdt = assertGrupoTrabajoId(grupoTrabajoId);
  const res = await callMaterializarTurnoTeoricoDia({
    persona_id: personaId,
    fecha: fechaYmd,
    grupo_trabajo_id: gdt,
  });
  return res?.data ?? res;
}

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId
 */
export async function leerCapaTeoricaCelda(personaId, fechaYmd, grupoTrabajoId) {
  const gdt = assertGrupoTrabajoId(grupoTrabajoId);
  const res = await callObtenerCapaTeoricaDia({
    persona_id: personaId,
    fecha: fechaYmd,
    grupo_trabajo_id: gdt,
  });
  return res?.data ?? res;
}

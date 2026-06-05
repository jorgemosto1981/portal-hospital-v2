import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";

/**
 * HLg del titular vía callable paginado (misma vía que datos laborales RRHH).
 * @param {string} personaId
 */
export async function cargarHlgRowsParaTitular(personaId) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) return [];
  const rows = await listarColeccionLaboral("historial_laboral_grupos", 12_000);
  return rows.filter((r) => String(r.persona_id || "").trim() === pid);
}

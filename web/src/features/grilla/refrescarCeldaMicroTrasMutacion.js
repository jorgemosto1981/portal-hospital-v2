import { sanearMaterializacionDiaSiNecesario } from "../../services/grillaSanacionMaterializacionService.js";

/**
 * Ciclo micro en cliente (post-callable): alinea teoría si hace falta y fuerza recálculo fichada.
 * @param {{ persona_id: string; fecha_ymd: string; grupo_trabajo_id: string }} ref
 */
export async function refrescarCeldaMicroTrasMutacion(ref) {
  const persona_id = String(ref?.persona_id || "").trim();
  const fecha_ymd = String(ref?.fecha_ymd || "").trim();
  const grupo_trabajo_id = String(ref?.grupo_trabajo_id || "").trim();
  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(grupo_trabajo_id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd)) {
    return;
  }
  try {
    await sanearMaterializacionDiaSiNecesario({
      persona_id,
      fecha: fecha_ymd,
      grupo_trabajo_id,
      aplicar_si_desalineado: true,
      forzar_recalculo_fichada: true,
    });
  } catch {
    /* no bloquear UI si un día falla */
  }
}

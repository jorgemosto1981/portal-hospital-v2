import { httpsCallable } from "firebase/functions";
import { getFunctionsV2 } from "./functionsV2.js";
import { assertGrupoTrabajoId } from "../features/grilla/grillaGrupoUtils.js";

/**
 * Evalúa firma persistida vs motor unificado; rematerializa el día si está desalineado.
 * @param {{
 *   persona_id: string;
 *   fecha: string;
 *   grupo_trabajo_id: string;
 *   aplicar_si_desalineado?: boolean;
 *   teoria_refs_licencia?: Array<Record<string, unknown>>;
 * }} data
 */
export async function sanearMaterializacionDiaSiNecesario(data) {
  const gdt = assertGrupoTrabajoId(data.grupo_trabajo_id || data.grupo_id);
  const fn = httpsCallable(getFunctionsV2(), "sanearMaterializacionDiaSiNecesario", { timeout: 120000 });
  const refs = Array.isArray(data.teoria_refs_licencia) ? data.teoria_refs_licencia : [];
  const res = await fn({
    persona_id: String(data.persona_id || "").trim(),
    fecha: String(data.fecha || "").trim(),
    grupo_trabajo_id: gdt,
    aplicar_si_desalineado: data.aplicar_si_desalineado !== false,
    teoria_refs_licencia: refs,
  });
  return res?.data ?? res;
}

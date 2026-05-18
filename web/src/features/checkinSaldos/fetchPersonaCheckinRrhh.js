import { callObtenerResumenAltaOnboardingPersona } from "../../services/callables.js";

/**
 * Estado de persona para check-in RRHH vía Admin SDK (evita permission-denied en Rules).
 * @param {string} personaId
 */
export async function fetchPersonaCheckinRrhh(personaId) {
  const per = String(personaId || "").trim();
  if (!/^per_/i.test(per)) {
    return { persona: null, anioCortePortalA: null };
  }
  const res = await callObtenerResumenAltaOnboardingPersona({ persona_id: per });
  const data = res?.data && typeof res.data === "object" ? res.data : {};
  const persona = data.persona && typeof data.persona === "object" ? data.persona : null;
  const anioRaw = data.anio_corte_portal_a ?? persona?.anio_corte_portal_a;
  const anioCortePortalA =
    anioRaw != null && Number.isInteger(Number(anioRaw)) ? Number(anioRaw) : null;
  return { persona, anioCortePortalA };
}

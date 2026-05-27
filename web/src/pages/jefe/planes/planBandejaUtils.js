/**
 * Visibilidad de planes en bandeja de aprobación del jefe (no RRHH).
 */

export function filtrarPlanesBandejaJefe(planes, personaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return [];

  return (planes || []).filter((plan) => {
    if (plan.estado !== "ENVIADO" && plan.estado !== "EN_REVISION") return false;

    const pend = plan.aprobacion_pendiente;
    if (!pend) return false;

    if (pend.huerfano) return false;

    const creador = String(plan.creado_por_persona_id || "").trim();
    if (creador && creador === pid) return false;

    return (pend.autorizadores_elegibles_ids || []).includes(pid);
  });
}

export function contarPlanesBandejaJefe(planes, personaId) {
  return filtrarPlanesBandejaJefe(planes, personaId).length;
}

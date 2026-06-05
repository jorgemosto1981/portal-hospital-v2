/** Alineado con functions/modules/asistencia/planTurnoServicioMeta.js */

export const PLAN_ROL_PRINCIPAL = "principal";
export const PLAN_ROL_INCORPORACION = "incorporacion";

const FLUJO_INCORPORACION_ACTIVO = new Set(["BORRADOR", "ENVIADO", "EN_REVISION"]);

export function planRolDe(plan) {
  const r = String(plan?.plan_rol || "").trim();
  return r === PLAN_ROL_INCORPORACION ? PLAN_ROL_INCORPORACION : PLAN_ROL_PRINCIPAL;
}

export function esPlanIncorporacion(plan) {
  return planRolDe(plan) === PLAN_ROL_INCORPORACION;
}

/** Planes operativos (excluye hijos y MERGEADO). */
export function planesPrincipales(items) {
  return (items || []).filter(
    (p) => p.eliminado !== true && p.estado !== "MERGEADO" && planRolDe(p) === PLAN_ROL_PRINCIPAL,
  );
}

export function planPrincipalCanonico(items) {
  const list = planesPrincipales(items);
  const orden = ["HABILITADO", "ENVIADO", "EN_REVISION", "BORRADOR", "CERRADO"];
  for (const estado of orden) {
    const found = list.find((p) => p.estado === estado);
    if (found) return found;
  }
  return list[0] || null;
}

export function planIncorporacionActivo(items) {
  return (
    (items || []).find(
      (p) =>
        p.eliminado !== true &&
        p.estado !== "MERGEADO" &&
        planRolDe(p) === PLAN_ROL_INCORPORACION &&
        FLUJO_INCORPORACION_ACTIVO.has(p.estado),
    ) || null
  );
}

export function estadoResumenGrupo(items) {
  const principal = planPrincipalCanonico(items);
  if (!principal) return "SIN_PLAN";
  return principal.estado || "SIN_PLAN";
}

export function grupoTieneInboxPendiente(items) {
  const inc = planIncorporacionActivo(items);
  if (inc && (inc.estado === "ENVIADO" || inc.estado === "EN_REVISION")) return true;
  const pr = planPrincipalCanonico(items);
  if (pr && (pr.estado === "ENVIADO" || pr.estado === "EN_REVISION")) return true;
  return false;
}

export function estadoInboxGrupo(items) {
  const inc = planIncorporacionActivo(items);
  if (inc && (inc.estado === "ENVIADO" || inc.estado === "EN_REVISION")) return inc.estado;
  const pr = planPrincipalCanonico(items);
  if (pr && (pr.estado === "ENVIADO" || pr.estado === "EN_REVISION")) return pr.estado;
  return "";
}

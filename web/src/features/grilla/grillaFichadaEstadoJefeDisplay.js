/** Etiquetas UI del semáforo §14 (solo lectura en cliente). */

/** @param {string|null|undefined} estado */
export function etiquetaEstadoFichadaJefe(estado) {
  const e = String(estado || "").trim();
  if (e === "ALERTA") return "Alerta";
  if (e === "RRHH_PENDIENTE") return "Pendiente RRHH";
  if (e === "RRHH_RESUELTO") return "Revisado RRHH";
  if (e === "OK") return "Conforme";
  return null;
}

/** @param {string|null|undefined} estado */
export function simboloEstadoFichadaJefe(estado) {
  const e = String(estado || "").trim();
  if (e === "ALERTA") return "✕";
  if (e === "RRHH_PENDIENTE") return "!";
  if (e === "RRHH_RESUELTO") return "◆";
  if (e === "OK") return "✓";
  return null;
}

/** @param {Record<string, unknown>|null|undefined} cell */
export function estadoFichadaJefeDesdeCelda(cell) {
  if (!cell || typeof cell !== "object") return null;
  const estado = cell.estado_fichada_jefe;
  if (!estado) return null;
  return {
    estado: String(estado),
    tooltip: String(cell.estado_fichada_jefe_tooltip || etiquetaEstadoFichadaJefe(estado) || ""),
  };
}

/** @param {string} estado */
export function clasesBadgeEstadoFichadaJefe(estado) {
  const e = String(estado || "");
  if (e === "ALERTA") return "bg-rose-100 text-rose-900 ring-rose-300";
  if (e === "RRHH_PENDIENTE") return "bg-amber-100 text-amber-950 ring-amber-300";
  if (e === "RRHH_RESUELTO") return "bg-sky-100 text-sky-900 ring-sky-300";
  if (e === "OK") return "bg-emerald-100 text-emerald-900 ring-emerald-300";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

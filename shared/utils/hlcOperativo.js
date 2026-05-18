/**
 * HLc operativo vigente (sin baja ni fecha fin).
 * @param {unknown} row
 */
export function isHlcOperativo(row) {
  if (!row || typeof row !== "object") return false;
  if (row.activo === false) return false;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return false;
  const hasta = String(row.fecha_hasta || row.fecha_fin || "").trim();
  return !hasta;
}

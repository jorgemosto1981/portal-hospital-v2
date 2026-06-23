/** Mensajes toast unificados tras materialización GSO (F2.1). */

const MOTIVO_LABEL = {
  job_dia5_m_plus_1: "job día 5",
  job_dia5_m_condicional: "job día 5",
  job_dia5_m_cambio_base: "job día 5",
  hlg_alta: "alta HLg",
  hlg_deshabilitar: "baja HLg",
  materializar_rango: "rango",
  feriado_institucional: "feriado institucional",
  rematerializar_calendario: "calendario",
  rematerializar_regimen: "régimen",
  materializar_grupo_mes: "sector",
};

/**
 * @param {string} motivo
 */
export function etiquetaMotivoMaterializacion(motivo) {
  const key = String(motivo || "").trim().toLowerCase();
  if (!key) return "";
  return MOTIVO_LABEL[key] || key.replace(/_/g, " ");
}

/**
 * @param {{ materializado_lazy?: boolean, metadata?: { ultimo_motivo?: string } | null }} vista
 */
export function mensajeToastMaterializacionLazy(vista) {
  if (vista?.materializado_lazy !== true) return null;
  const etiqueta = etiquetaMotivoMaterializacion(vista?.metadata?.ultimo_motivo);
  return etiqueta
    ? `Turno teórico recalculado (${etiqueta}).`
    : "Turno teórico recalculado al vuelo para este cargo.";
}

/**
 * US-11 — mensaje alineado con titular tras materializar sector (equipo).
 * @param {{ ok?: boolean; procesados?: number } | null | undefined} matGrupo
 */
export function mensajeToastMaterializacionGrupo(matGrupo) {
  if (matGrupo?.omitida === true) return null;
  if (matGrupo?.ok !== true) return null;
  const n = Number(matGrupo.procesados);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n === 1
    ? "Turno teórico recalculado al vuelo para 1 agente-mes del sector."
    : `Turno teórico recalculado al vuelo (${n} agente-mes en el sector).`;
}

/**
 * Snapshot del paso 1 → 2 del wizard LAO (sin lógica de negocio).
 * @param {Record<string, unknown> | null | undefined} resumen
 * @param {string} [grupoTrabajoIdAncla]
 */
export function buildLaoWizardCtxFromResumen(resumen, grupoTrabajoIdAncla = "") {
  if (!resumen || typeof resumen !== "object") return null;
  const versionId = String(resumen.version_aplicada_id || "").trim();
  if (!/^ver_/i.test(versionId)) return null;
  const anio = Number(resumen.anio_origen_bolsa_activo);
  if (!Number.isInteger(anio) || anio < 1900) return null;
  const versionComputo = resumen.version_computo;
  if (!versionComputo || typeof versionComputo !== "object") return null;

  const gdt = String(grupoTrabajoIdAncla || "").trim();

  return {
    version_aplicada_id: versionId,
    anio_origen_bolsa_activo: anio,
    correspondencia_anio: Number.isInteger(Number(resumen.correspondencia_anio))
      ? Number(resumen.correspondencia_anio)
      : anio,
    ejercicio_label:
      typeof resumen.ejercicio_label === "string" ? resumen.ejercicio_label.trim() : null,
    version_computo: versionComputo,
    grupo_trabajo_id_ancla: /^gdt_/i.test(gdt) ? gdt : "",
  };
}

/** @typedef {{ version_aplicada_id: string, anio_origen_bolsa_activo: number, correspondencia_anio: number, ejercicio_label: string | null, version_computo: { bloque_topes_plazos_computo?: Record<string, unknown> }, grupo_trabajo_id_ancla: string }} LaoWizardCtx */

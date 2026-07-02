"use strict";

/**
 * Adjuntos de certificado para bandeja auditoría (desde sol_* Caja Negra, sin fetch extra).
 *
 * @param {Record<string, unknown>} sol
 * @returns {Array<{ storage_path: string, nombre_archivo: string, content_type: string, es_pdf: boolean }>}
 */
function mapearAdjuntosBandejaAuditor(sol) {
  const ing = sol.ingreso_medico && typeof sol.ingreso_medico === "object" ? sol.ingreso_medico : {};
  const raw = Array.isArray(ing.adjuntos) ? ing.adjuntos : [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const storage_path = String(row.storage_path || "").trim();
    if (!storage_path) continue;
    const nombre_archivo = String(row.nombre_archivo || "Certificado médico").trim() || "Certificado médico";
    const content_type = String(row.content_type || "application/pdf").trim() || "application/pdf";
    const es_pdf =
      content_type.toLowerCase().includes("pdf") || nombre_archivo.toLowerCase().endsWith(".pdf");
    out.push({ storage_path, nombre_archivo, content_type, es_pdf });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} sol
 */
function tieneCertificadoBandejaAuditor(sol) {
  return mapearAdjuntosBandejaAuditor(sol).length > 0;
}

module.exports = {
  mapearAdjuntosBandejaAuditor,
  tieneCertificadoBandejaAuditor,
};

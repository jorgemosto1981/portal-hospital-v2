/** Copy legible para alertas semánticas (modal jefe). */

const HERRAMIENTA_LABEL = {
  SOLICITAR_LICENCIA_FRANQUICIA: "Solicitar licencia por franquicia",
  DERIVAR_RRHH_MARCA_MANUAL: "Derivar a RRHH / carga manual de marcas",
  CAMBIO_INTERCAMBIO_TURNO_EXISTENTE: "Revisar cambio o intercambio de turno",
};

/**
 * @param {string|null|undefined} codigo
 */
export function etiquetaHerramientaSugerida(codigo) {
  const c = String(codigo || "").trim();
  if (!c) return "";
  return HERRAMIENTA_LABEL[c] || c.replace(/_/g, " ").toLowerCase();
}

export const MASCARA_RELOJ_DEFAULT = "TTTTT DD/MM/YY HH:MM RRR CC";

export const POLITICAS_DUPLICADOS_OPCIONES = [
  { value: "EXCLUIR_SEGUNDA", label: "Excluir segunda marca (< umbral)" },
  { value: "MANTENER_TODAS", label: "Mantener todas las marcas" },
  { value: "BLOQUEAR_APLICAR", label: "Bloquear aplicar si hay duplicados" },
];

/**
 * @param {Record<string, unknown>|null|undefined} reloj
 */
export function estadoFormDesdeReloj(reloj) {
  if (!reloj) {
    return {
      reloj_id: "",
      nombre: "",
      grupo_trabajo_id: "",
      numero_reloj: "",
      mascara_tokens: MASCARA_RELOJ_DEFAULT,
      umbral_duplicado_minutos: 2,
      politica_duplicados: "EXCLUIR_SEGUNDA",
      activo: true,
    };
  }
  const p = reloj.politica_validacion;
  return {
    reloj_id: String(reloj.id || ""),
    nombre: String(reloj.nombre || ""),
    grupo_trabajo_id: String(reloj.grupo_trabajo_id || reloj.grupo_id || ""),
    numero_reloj: String(reloj.numero_reloj || ""),
    mascara_tokens: String(reloj.mascara_tokens || MASCARA_RELOJ_DEFAULT),
    umbral_duplicado_minutos: Number(p?.umbral_duplicado_minutos) || 2,
    politica_duplicados: String(p?.duplicados || "EXCLUIR_SEGUNDA"),
    activo: reloj.activo !== false,
  };
}

/**
 * @param {ReturnType<typeof estadoFormDesdeReloj>} form
 */
export function payloadGuardarDesdeForm(form) {
  const base = {
    nombre: form.nombre.trim(),
    grupo_trabajo_id: form.grupo_trabajo_id.trim(),
    numero_reloj: form.numero_reloj.trim(),
    mascara_tokens: form.mascara_tokens.trim() || MASCARA_RELOJ_DEFAULT,
    politica_validacion: {
      umbral_duplicado_minutos: Number(form.umbral_duplicado_minutos) || 2,
      duplicados: form.politica_duplicados,
    },
    activo: form.activo !== false,
  };
  if (form.reloj_id) return { ...base, reloj_id: form.reloj_id };
  return base;
}

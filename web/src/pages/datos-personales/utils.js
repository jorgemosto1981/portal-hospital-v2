export function emptyFamiliar() {
  return {
    familiar_id: "",
    parentesco_id: "",
    parentesco_otro_detalle: "",
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    convive: true,
    domicilio_familiar: "",
    dependiente: false,
    detalle_dependencia: "",
    discapacidad_declarada: false,
    notas_titular: "",
    estado_auditoria_familiar_id: "CFG_EAF_01_PENDIENTE",
    motivo_rechazo_id: "",
    motivo_rechazo_detalle: "",
    observacion_auditoria: "",
    auditado_en: "",
    auditado_por_persona_id: "",
  };
}

export function toOpts(rows) {
  return (rows || []).map((r) => ({ value: String(r.id), label: String(r.nombre || r.id) }));
}

export function normalizarWarnings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const code = typeof w.code === "string" ? w.code.trim() : "";
      const message = typeof w.message === "string" ? w.message.trim() : "";
      if (!code && !message) return null;
      return { code, message };
    })
    .filter(Boolean);
}

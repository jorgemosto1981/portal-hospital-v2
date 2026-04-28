export function emptyFamiliar() {
  return {
    parentesco_id: "",
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    convive: false,
    dependiente: false,
    discapacidad_declarada: false,
    notas_titular: "",
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

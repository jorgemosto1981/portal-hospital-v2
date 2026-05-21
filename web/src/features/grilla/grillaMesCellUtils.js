export function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

export function etiquetaCelda(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) return "";
  return String(eventos[0].codigo_grilla || "").trim() || "·";
}

export function colorCelda(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) return null;
  return String(eventos[0].color_ui || "#94a3b8");
}

export function celdaPendiente(eventos) {
  return (
    Array.isArray(eventos) &&
    eventos.some((e) => String(e.estado_solicitud_id || "").includes("revision"))
  );
}

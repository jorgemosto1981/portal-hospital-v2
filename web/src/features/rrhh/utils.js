export function etiquetaCatalogo(item) {
  if (!item) return "";
  if (typeof item.titulo_ui === "string" && item.titulo_ui) return item.titulo_ui;
  if (typeof item.nombre === "string" && item.nombre) return item.nombre;
  return item.id || "";
}

export function etiquetaPersona(p) {
  if (!p) return "";
  const apellido = String(p.apellido || "").trim();
  const nombre = String(p.nombre || "").trim();
  const full = [apellido, nombre].filter(Boolean).join(" ").trim();
  const dni = String(p.dni || "").trim();
  if (full && dni) return `${p.id} (${full} - DNI ${dni})`;
  if (full) return `${p.id} (${full})`;
  if (dni) return `${p.id} (DNI ${dni})`;
  return p.id || "";
}

export function normalizeDni(dni) {
  return String(dni || "").replace(/\D/g, "");
}

export function isValidPersonaId(personaId) {
  return /^per_/i.test(String(personaId || "").trim());
}

export function buildAltaAgentePayload({ dni, nombre, apellido }) {
  return {
    dni: normalizeDni(dni),
    nombre: String(nombre || "").trim(),
    apellido: String(apellido || "").trim(),
  };
}

export function buildActualizarEstadoPayload({ personaEstadoId, estadoAccesoId, motivoEstado }) {
  return {
    persona_id: String(personaEstadoId || "").trim(),
    estado_acceso_id: estadoAccesoId,
    motivo: String(motivoEstado || "").trim() || null,
  };
}

export function buildBajaLaboralPayload({
  personaBajaId,
  fechaBaja,
  causalFinAsignacionId,
  motivoBajaId,
  bloquearAccesoEnBaja,
  estadoAccesoId,
  motivoBajaTexto,
}) {
  return {
    persona_id: String(personaBajaId || "").trim(),
    fecha_baja_laboral: fechaBaja,
    causal_fin_asignacion_id: causalFinAsignacionId,
    motivo_baja_id: motivoBajaId || null,
    bloquear_acceso: bloquearAccesoEnBaja,
    estado_acceso_id: estadoAccesoId || "cfg_eca_bloq",
    motivo: String(motivoBajaTexto || "").trim() || null,
  };
}

export function buildReinicioPayload({
  personaReinicioId,
  resetEstadoOnboarding,
  estadoAccesoReinicioId,
  motivoReinicio,
}) {
  return {
    persona_id: String(personaReinicioId || "").trim(),
    reset_estado_onboarding: resetEstadoOnboarding,
    estado_acceso_id: estadoAccesoReinicioId,
    motivo: String(motivoReinicio || "").trim() || null,
  };
}

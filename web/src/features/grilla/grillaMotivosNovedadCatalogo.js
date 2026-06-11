/**
 * Catálogo UI de tipos de novedad / justificación en overrides GSO (T-06 paso 3).
 * `requiereAuditoriaCentral`: solo RRHH (bypass US-13).
 */

/** @typedef {{ id: string; codigo: string; label: string; requiereAuditoriaCentral?: boolean }} MotivoNovedadGso */

/** @type {MotivoNovedadGso[]} */
export const CATALOGO_MOTIVOS_NOVEDAD_GSO = [
  {
    id: "urgencia_operativa",
    codigo: "URG_OPE",
    label: "Urgencia operativa",
    requiereAuditoriaCentral: false,
  },
  {
    id: "cobertura_falta",
    codigo: "COB_FALTA",
    label: "Cobertura por falta inesperada",
    requiereAuditoriaCentral: false,
  },
  {
    id: "intercambio_acordado",
    codigo: "INT_GUARD",
    label: "Intercambio de guardia acordado",
    requiereAuditoriaCentral: false,
  },
  {
    id: "traslado_operativo",
    codigo: "TRAS_PRO",
    label: "Traslado / cambio de turno propio",
    requiereAuditoriaCentral: false,
  },
  {
    id: "override_huelga",
    codigo: "OVR_HUELGA",
    label: "Override conflicto colectivo / huelga",
    requiereAuditoriaCentral: true,
  },
  {
    id: "regularizacion_liquidacion",
    codigo: "AUD_LIQ",
    label: "Regularización liquidación (auditoría central)",
    requiereAuditoriaCentral: true,
  },
  {
    id: "otro",
    codigo: "OTRO",
    label: "Otro motivo operativo",
    requiereAuditoriaCentral: false,
  },
];

/**
 * @param {string} id
 */
export function motivoNovedadPorId(id) {
  const key = String(id || "").trim();
  return CATALOGO_MOTIVOS_NOVEDAD_GSO.find((n) => n.id === key) || null;
}

/**
 * @param {string} codigoNovedadId
 * @param {string} detalle
 */
export function componerMotivoNovedadGso(codigoNovedadId, detalle) {
  const nov = motivoNovedadPorId(codigoNovedadId);
  const d = String(detalle || "").trim();
  if (!nov) return d;
  if (!d) return `[${nov.codigo}] ${nov.label}`;
  return `[${nov.codigo}] ${nov.label}: ${d}`;
}

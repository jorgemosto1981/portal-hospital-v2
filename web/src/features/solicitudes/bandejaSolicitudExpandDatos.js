import { formatInstanteBandeja, formatRangoFechasBandeja, diasLabelBandeja } from "./bandejaSolicitudesFormat.js";

/** @param {unknown} v */
function textoValor(v) {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  return String(v).trim();
}

/**
 * @param {Record<string, unknown>} sel
 * @param {string} key
 */
function valorExpand(sel, key) {
  const raw = sel[key];
  if (key === "fecha_licencia") {
    return formatRangoFechasBandeja(sel.fecha_desde, sel.fecha_hasta);
  }
  if (key === "dias_solicitados") {
    return diasLabelBandeja(raw);
  }
  if (key.endsWith("_en")) {
    return formatInstanteBandeja(raw) || "";
  }
  return textoValor(raw);
}

/** @type {{ key: string, label: string }[]} */
export const EXPAND_FILAS_JEFE = [
  { key: "solicitud_id", label: "ID solicitud" },
  { key: "estado_solicitud_id", label: "Estado (catálogo)" },
  { key: "etiqueta_estado", label: "Estado (bandeja)" },
  { key: "articulo_id", label: "ID artículo" },
  { key: "codigo_grilla", label: "Código grilla" },
  { key: "articulo_nombre", label: "Nombre artículo" },
  { key: "articulo_label", label: "Etiqueta artículo" },
  { key: "patron_saldo", label: "Patrón saldo" },
  { key: "dias_solicitados", label: "Días solicitados" },
  { key: "fecha_licencia", label: "Fechas licencia" },
  { key: "titular_persona_id", label: "ID titular" },
  { key: "titular_label", label: "Titular" },
  { key: "titular_dni", label: "DNI titular" },
  { key: "grupo_trabajo_id_ancla", label: "Grupo ancla (id)" },
  { key: "creado_en", label: "Alta del trámite" },
  { key: "jefe_revision_en", label: "Decisión jefatura" },
  { key: "jefe_revision_persona_id", label: "Jefe que decidió (id)" },
  { key: "jefe_motivo", label: "Motivo jefatura" },
];

/** @type {{ key: string, label: string }[]} */
export const EXPAND_FILAS_RRHH = [
  ...EXPAND_FILAS_JEFE,
  { key: "bandeja_rrhh_modo", label: "Modo bandeja RRHH" },
  { key: "autorizacion_rrhh_sustituta", label: "Huérfana (RRHH sustituta)" },
  { key: "autorizadores_elegibles_ids", label: "Autorizadores elegibles" },
  { key: "jefe_revision_en", label: "Cierre jefatura (fecha)" },
  { key: "jefe_revision_persona_id", label: "Jefe que cerró (id)" },
  { key: "jefe_motivo", label: "Motivo jefatura" },
  { key: "puede_aprobar_rechazar", label: "Puede aprobar/rechazar RRHH" },
  { key: "puede_registrar_toma_conocimiento", label: "Puede registrar TC" },
  { key: "rrhh_revision_en", label: "Revisión RRHH (legacy)" },
  { key: "rrhh_revision_persona_id", label: "Revisor RRHH legacy (id)" },
  { key: "rrhh_motivo", label: "Motivo RRHH legacy" },
  { key: "rrhh_toma_conocimiento_en", label: "Toma de conocimiento RRHH" },
  { key: "rrhh_toma_conocimiento_motivo", label: "Motivo toma de conocimiento" },
];

/**
 * @param {{ sel: Record<string, unknown>, variant: 'jefe' | 'rrhh', className?: string }} props
 */
export function filasExpandConValor(sel, variant) {
  const defs = variant === "rrhh" ? EXPAND_FILAS_RRHH : EXPAND_FILAS_JEFE;
  return defs
    .map(({ key, label }) => {
      const value = valorExpand(sel, key);
      if (!value) return null;
      return { key, label, value };
    })
    .filter(Boolean);
}

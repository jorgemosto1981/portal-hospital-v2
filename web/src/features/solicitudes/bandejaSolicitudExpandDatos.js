import { formatInstanteBandeja, formatRangoFechasBandeja, diasLabelBandeja } from "./bandejaSolicitudesFormat.js";
import { esFamilia64SinModalidad, nombreArticuloParaJefe } from "./familia64Label.js";

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
  if (key === "articulo_label_neutro") {
    if (!esFamilia64SinModalidad(sel)) return textoValor(sel.articulo_label);
    const codigo = String(sel.codigo_grilla || "").trim();
    const nombre = nombreArticuloParaJefe(sel, "");
    return codigo ? `${codigo} ${nombre}` : nombre;
  }
  if (key === "fecha_licencia") {
    return formatRangoFechasBandeja(sel.fecha_desde, sel.fecha_hasta);
  }
  if (key === "dias_solicitados") {
    return diasLabelBandeja(raw);
  }
  if (key.endsWith("_en")) {
    return formatInstanteBandeja(raw) || "";
  }
  if (key === "diagnostico_licencia_medica") {
    const cod = String(sel.cie10_codigo || "").trim();
    const desc = String(sel.cie10_descripcion || "").trim();
    if (cod && desc) return `${cod} — ${desc}`;
    return desc || cod;
  }
  return textoValor(raw);
}

/**
 * Detalle técnico completo: roles administrativos (RRHH, auditoría, junta médica),
 * que sí necesitan ids, catálogos y patrón de saldo para trazar el trámite.
 * @type {{ key: string, label: string }[]}
 */
export const EXPAND_FILAS_TECNICAS = [
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
  { key: "grupos_trabajo_involucrados_ids", label: "Grupos involucrados (snapshot)" },
  { key: "creado_en", label: "Alta del trámite" },
  { key: "jefe_revision_en", label: "Decisión jefatura" },
  { key: "jefe_revision_persona_id", label: "Jefe que decidió (id)" },
  { key: "jefe_motivo", label: "Motivo jefatura" },
];

/**
 * Bandeja jefe: solo lo que necesita para decidir la autorización.
 * Sin ids, códigos de catálogo ni patrón de saldo (eso es dato de gestión RRHH).
 * @type {{ key: string, label: string }[]}
 */
export const EXPAND_FILAS_JEFE = [
  { key: "articulo_label_neutro", label: "Solicitud" },
  { key: "dias_solicitados", label: "Días solicitados" },
  { key: "fecha_licencia", label: "Fechas licencia" },
  { key: "titular_label", label: "Titular" },
  { key: "titular_dni", label: "DNI titular" },
  { key: "grupo_trabajo_ancla_label", label: "Grupo de trabajo" },
  { key: "creado_en", label: "Alta del trámite" },
  { key: "jefe_revision_en", label: "Decisión jefatura" },
  { key: "jefe_motivo", label: "Motivo jefatura" },
];

const JEFE_KEYS_RRHH_RELABEL = new Set([
  "jefe_revision_en",
  "jefe_revision_persona_id",
  "jefe_motivo",
]);

/** @type {{ key: string, label: string }[]} */
export const EXPAND_FILAS_RRHH = [
  ...EXPAND_FILAS_TECNICAS.filter((f) => !JEFE_KEYS_RRHH_RELABEL.has(f.key)),
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

export const EXPAND_FILAS_AUDITOR = [
  ...EXPAND_FILAS_TECNICAS.filter((f) => !["jefe_revision_en", "jefe_revision_persona_id", "jefe_motivo", "patron_saldo"].includes(f.key)),
  { key: "version_aplicada_id", label: "Versión artículo (id)" },
  { key: "es_licencia_larga", label: "Licencia larga (Art. 16/19)" },
  { key: "fase_motor", label: "Fase motor" },
  { key: "causal_larga_nombre", label: "Causal Art. 19" },
  { key: "causal_larga_duracion_id", label: "ID causal larga" },
  { key: "diagnostico_licencia_medica", label: "Diagnóstico CIE-10" },
  { key: "es_licencia_incompleta", label: "Licencia incompleta" },
  { key: "vencimiento_plazo_certificado", label: "Vencimiento plazo certificado" },
  { key: "puede_clasificar", label: "Puede clasificar" },
];

export const EXPAND_FILAS_JUNTA = [
  ...EXPAND_FILAS_TECNICAS.filter((f) => !["jefe_revision_en", "jefe_revision_persona_id", "jefe_motivo", "patron_saldo"].includes(f.key)),
  { key: "version_aplicada_id", label: "Versión artículo (id)" },
  { key: "auditor_observacion", label: "Observación auditor" },
  { key: "auditor_persona_id", label: "Auditor (id)" },
  { key: "puede_dictaminar", label: "Puede dictaminar" },
];

/**
 * @param {{ sel: Record<string, unknown>, variant: 'jefe' | 'rrhh' | 'auditor' | 'junta', className?: string }} props
 */
export function filasExpandConValor(sel, variant) {
  const defs =
    variant === "rrhh"
      ? EXPAND_FILAS_RRHH
      : variant === "auditor"
        ? EXPAND_FILAS_AUDITOR
        : variant === "junta"
          ? EXPAND_FILAS_JUNTA
          : EXPAND_FILAS_JEFE;
  return defs
    .map(({ key, label }) => {
      const value = valorExpand(sel, key);
      if (!value) return null;
      return { key, label, value };
    })
    .filter(Boolean);
}

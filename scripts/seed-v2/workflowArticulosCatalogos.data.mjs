/**
 * Filas de catálogo para la pestaña Workflow (config. artículos V2).
 */
import { Timestamp } from "firebase-admin/firestore";

const t0 = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

const base = () => ({
  activo: true,
  vigente_desde: t0,
  vigente_hasta: null,
  seed_version: 1,
  seed_fase: "F1-2026-04",
});

function cfgRow(id, codigo_interno, nombre, orden = 10, extra = {}) {
  return {
    id,
    data: {
      ...base(),
      codigo_interno,
      nombre,
      titulo_ui: nombre,
      orden,
      ...extra,
    },
  };
}

export function cfgOrigenAltaSolicitud() {
  return [
    cfgRow("CFG_OAS_AGENTE", "AGENTE", "Autogestión del agente", 10),
    cfgRow("CFG_OAS_JEFE_GRUPO", "JEFE_GRUPO", "Iniciado por jefe de grupo", 20),
    cfgRow("CFG_OAS_RRHH", "RRHH", "Carga directa por RRHH", 30),
  ];
}

export function cfgReglaSplitRemanente() {
  return [
    cfgRow("CFG_RSR_RECHAZAR_REMANENTE", "RECHAZAR_REMANENTE", "Rechazar remanente", 10),
    cfgRow("CFG_RSR_NUEVA_SOLICITUD", "NUEVA_SOLICITUD", "Crear nueva solicitud para remanente", 20),
    cfgRow("CFG_RSR_DERIVAR_RRHH", "DERIVAR_RRHH", "Derivar remanente a decisión RRHH", 30),
  ];
}

export function cfgPrioridadNormativa() {
  return [
    cfgRow("CFG_PN_DECRETO_PREVALECE", "DECRETO_PREVALECE", "Prevalece decreto / norma principal", 10),
    cfgRow("CFG_PN_POLITICA_INSTITUCIONAL", "POLITICA_INSTITUCIONAL", "Prevalece política institucional", 20),
    cfgRow("CFG_PN_DECISION_RRHH", "DECISION_RRHH", "Resolver por decisión RRHH", 30),
  ];
}

export function cfgPoliticaSuperposicion() {
  return [
    cfgRow("CFG_PS_BLOQUEO_TOTAL", "BLOQUEO_TOTAL", "Bloqueo total por superposición", 10),
    cfgRow("CFG_PS_PRIORIDAD_NORMATIVA", "PRIORIDAD_NORMATIVA", "Resolver por prioridad normativa", 20),
    cfgRow("CFG_PS_DERIVAR_RRHH", "DERIVAR_RRHH", "Derivar a RRHH", 30),
    cfgRow("CFG_PS_PERMITIR_CONVIVENCIA", "PERMITIR_CONVIVENCIA", "Permitir convivencia con registro", 40),
    cfgRow(
      "CFG_PS_INTERRUPCION_LISTA_ARTICULO",
      "INTERRUPCION_LISTA_ARTICULO",
      "Interrupción / prioridad según lista en cfg_articulos",
      45,
      {
        descripcion_ui:
          "Usa articulos_interrupcion_permitida_ids del artículo para resolver frente a otro trámite activo.",
      },
    ),
  ];
}

/**
 * Filas de catálogo para la pestaña Plazos (config. artículos V2).
 * Compartido por `seed-cfg.mjs` y `seed-articulos-plazos-catalogos.mjs`.
 *
 * @see docs/v2/MODULO_CONFIGURACION_ARTICULOS_V2.md
 * @see docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md
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

/**
 * Momento de entrega de documentación (antes / después / mixto).
 */
export function cfgMomentoEntregaDocumentacion() {
  return [
    cfgRow(
      "CFG_MED_ANTES",
      "ANTES_INICIO_O_DURANTE",
      "Antes del inicio o durante la licencia",
      10,
    ),
    cfgRow(
      "CFG_MED_DESPUES_ULTIMO_DIA",
      "DESPUES_ULTIMO_DIA_LIC",
      "Después del último día de licencia (documentación posterior)",
      20,
    ),
    cfgRow("CFG_MED_MIXTO", "MIXTO", "Mixto (combinación explícita según política)", 30),
  ];
}

/**
 * Cómputo del plazo documental. Ids `cfg_tcp_` + 26 caracteres — `web/src/schemas/articulo.schema.js`.
 */
export function cfgTipoComputoPlazo() {
  return [
    cfgRow(
      "cfg_tcp_01ARZ3NDEKTSV4RRFFQ69G2F0",
      "DIAS_CORRIDOS",
      "Días corridos (calendario civil)",
      10,
      {
        descripcion_ui:
          "Cómputo por días corridos; sin descuento por fines de semana ni feriados institucionales.",
      },
    ),
    cfgRow(
      "cfg_tcp_01BX5ZZKBKACTAV9WEVGEMMVRY",
      "DIAS_LABORALES_AGENTE",
      "Días laborales del agente (plantilla / RDA)",
      20,
      {
        descripcion_ui:
          "Basado en getDiasLaborablesAgente (solo días en que el agente debe trabajar). Feriados cfg_cfi se aplican en capa artículos si la política del artículo usa hábil compuesto.",
      },
    ),
    cfgRow(
      "cfg_tcp_01CY6ZZKBKACTAV9WEVGEMMVRZ",
      "HABIL_COMPUESTO_INST",
      "Hábil compuesto (laborales − feriados institucionales)",
      30,
      {
        descripcion_ui:
          "Laborables según MDC/RDA; restar fechas de cfg_calendario_feriados_institucional (filtro sustractivo capa licencias).",
      },
    ),
  ];
}

/**
 * Acción ante vencimiento de plazo. Default MVP: alerta + evento RRHH.
 */
export function cfgAccionVencimiento() {
  return [
    cfgRow(
      "CFG_AV_ALERTA_EVENTO_RRHH",
      "ALERTA_EVENTO_RRHH",
      "Alerta y evento a RRHH (default institucional MVP)",
      10,
      {
        descripcion_ui:
          "Sin rechazo automático de la solicitud; registro y notificación según política de eventos.",
      },
    ),
    cfgRow(
      "CFG_AV_ESCALAMIENTO",
      "ESCALAMIENTO",
      "Escalamiento / segunda línea",
      20,
      {
        descripcion_ui: "Deriva o escala según workflow cuando el plazo vence sin resolución.",
      },
    ),
    cfgRow(
      "CFG_AV_BLOQUEO_HASTA_REGULARIZAR",
      "BLOQUEO_TRAMITE",
      "Bloquear trámite hasta regularizar documentación",
      30,
    ),
    cfgRow(
      "CFG_AV_RECHAZO_POLITICA_EXPLICITA",
      "RECHAZO_AUTOMATICO",
      "Rechazo u observación dura (solo con política institucional explícita)",
      40,
      {
        descripcion_ui:
          "Usar solo si el hospital define política explícita; no es default normativo del MVP.",
      },
    ),
  ];
}

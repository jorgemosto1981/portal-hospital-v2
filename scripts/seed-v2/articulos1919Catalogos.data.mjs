/**
 * Catálogos extendidos — RFC_CFG_ARTICULOS_PARAMETROS_1919_V2.
 * Semillas para cfg_situacion_revista, cfg_unidad_intervalo_tiempo, cfg_paso_workflow_articulo.
 */
import { Timestamp } from "firebase-admin/firestore";

const t0 = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

const base = () => ({
  activo: true,
  vigente_desde: t0,
  vigente_hasta: null,
  seed_version: 1,
  seed_fase: "F1-2026-05-art1919",
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

/** Situación de revista / vínculo estable vs temporal (referencia RRHH). */
export function cfgSituacionRevista() {
  return [
    cfgRow("CFG_SREV_PLANTA", "PLANTA_PERMANENTE", "Planta permanente", 10),
    cfgRow("CFG_SREV_TEMPORARIO", "CONTRATO_TEMPORARIO", "Contrato / temporal", 20),
    cfgRow("CFG_SREV_SUPLENTE", "SUPLENTE", "Suplencia / cargo transitorio", 30),
  ];
}

/** Unidades para cadencia, preaviso y límites por periodo (ids `cfg_uit_` + ULID). */
export function cfgUnidadIntervaloTiempo() {
  return [
    cfgRow(
      "cfg_uit_01ARZ3NDEKTSV4RRFFQ69G2F0",
      "HORAS",
      "Horas",
      10,
      { descripcion_ui: "Intervalos o preavisos en horas (ej. 48 h hábiles en política aparte)." },
    ),
    cfgRow(
      "cfg_uit_01BX5ZZKBKACTAV9WEVGEMMVRY",
      "DIAS",
      "Días",
      20,
      { descripcion_ui: "Días corridos o según cómputo que aplique el motor al combinar con cfg_tcp_*." },
    ),
    cfgRow(
      "cfg_uit_01CY6ZZKBKACTAV9WEVGEMMVRZ",
      "MESES",
      "Meses",
      30,
      { descripcion_ui: "Ventanas mensuales o carencias en meses." },
    ),
    cfgRow(
      "cfg_uit_01DY7ZZKBKACTAV9WEVGEMMMRZ",
      "ANIOS",
      "Años",
      40,
      { descripcion_ui: "Límite anual o ventana por año civil según motor." },
    ),
  ];
}

/** Pasos atómicos de workflow (orden definido en cfg_articulos.paso_workflow_articulo_ids). */
export function cfgPasoWorkflowArticulo() {
  return [
    cfgRow(
      "cfg_pwa_01ARZ3NDEKTSV4RRFFQ69G2F0",
      "AUTORIZACION_JEFE",
      "Autorización / revisión jefe de grupo",
      10,
      { descripcion_ui: "Delegación operativa previa a RRHH cuando corresponde." },
    ),
    cfgRow(
      "cfg_pwa_01BX5ZZKBKACTAV9WEVGEMMVRY",
      "REVISION_RRHH",
      "Revisión RRHH",
      20,
      { descripcion_ui: "Control administrativo de legajo y política institucional." },
    ),
    cfgRow(
      "cfg_pwa_01CY6ZZKBKACTAV9WEVGEMMVRZ",
      "DICTAMEN_MEDICINA_LABORAL",
      "Dictamen medicina laboral",
      30,
      { descripcion_ui: "Paso ML distinto de auditoría clínica genérica." },
    ),
    cfgRow(
      "cfg_pwa_01DY7ZZKBKACTAV9WEVGEMMMRZ",
      "AUDITORIA_MEDICA",
      "Auditoría / auditoría médica",
      40,
      { descripcion_ui: "Control clínico posterior según política del artículo." },
    ),
    cfgRow(
      "cfg_pwa_01EZ8ZZKBKACTAV9WEVGEMNNRZ",
      "ASESORIA_LETRADA",
      "Asesoría letrada",
      50,
      { descripcion_ui: "Revisión jurídica institucional cuando el hospital lo exige." },
    ),
  ];
}

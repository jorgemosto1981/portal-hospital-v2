/**
 * Filas de catálogo para Documentación (config. artículos V2).
 * Colección: cfg_calendario_feriados_institucional (cfg_cfi_*).
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

export function cfgCalendarioFeriadosInstitucional() {
  return [
    cfgRow(
      "cfg_cfi_01ARZ3NDEKTSV4RRFFQ69G2F0",
      "FERIADO_NACIONAL",
      "Feriado nacional (global)",
      10,
      {
        fecha: "2026-05-25",
        tipo: "FERIADO_NACIONAL",
        alcance_efector_id: null,
      },
    ),
    cfgRow(
      "cfg_cfi_01BX5ZZKBKACTAV9WEVGEMMVRY",
      "ASUETO_LOCAL_CENTRAL",
      "Asueto local (Hospital Central)",
      20,
      {
        fecha: "2026-07-09",
        tipo: "ASUETO_LOCAL",
        alcance_efector_id: "CFG_EFE_HOSPITAL_CENTRAL",
      },
    ),
    cfgRow(
      "cfg_cfi_01CY6ZZKBKACTAV9WEVGEMMVRZ",
      "PUENTE_TURISTICO",
      "Puente turístico (global)",
      30,
      {
        fecha: "2026-12-07",
        tipo: "PUENTE_TURISTICO",
        alcance_efector_id: null,
      },
    ),
  ];
}

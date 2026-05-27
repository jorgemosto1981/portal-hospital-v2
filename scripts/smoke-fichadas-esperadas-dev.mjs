/**
 * Smoke Fase F — fórmula de fichadas esperadas por bloques continuos.
 *
 * A) Continuidad M+T+N para XX (sin extras): 1 bloque continuo => 2
 * B) XX cede T a YY (M y N para XX): 2 bloques => 4
 * C) Igual B + salida momentánea (2 extras): 4 + 2 => 6
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCapaTeoricaSegmentada } = require("../functions/modules/asistencia/capaTeoricaSegmentosCore.js");

const personaXX = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const personaYY = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const fecha = "2026-06-10";

const regimen = {
  turnos_disponibles: [
    { turno_id: "cfg_reg_turno_01_manana", ingreso: "08:00", egreso: "16:00" },
    { turno_id: "cfg_reg_turno_02_tarde", ingreso: "16:00", egreso: "20:00" },
    { turno_id: "cfg_reg_turno_03_noche", ingreso: "20:00", egreso: "08:00" },
  ],
};

const capaA = buildCapaTeoricaSegmentada({
  fechaYmd: fecha,
  personaId: personaXX,
  regimen,
  tipo_dia: "laborable",
  turnoCompuestoId: "cfg_reg_turno_01_manana+cfg_reg_turno_02_tarde+cfg_reg_turno_03_noche",
  origen_segmento: "plan_base",
  indiceCalendario: null,
});

const segmentosCedidos = (capaA.segmentos || []).map((s) => {
  if (s.segmento_id === "cfg_reg_turno_02_tarde") {
    return {
      ...s,
      persona_titular_id: personaXX,
      persona_ejecutante_id: personaYY,
      origen_segmento: "override_cobertura",
    };
  }
  return s;
});

const capaB = buildCapaTeoricaSegmentada({
  fechaYmd: fecha,
  personaId: personaXX,
  regimen,
  tipo_dia: "laborable",
  turnoCompuestoId: null,
  origen_segmento: "plan_base",
  indiceCalendario: null,
  segmentosOverride: segmentosCedidos,
});

const capaC = buildCapaTeoricaSegmentada({
  fechaYmd: fecha,
  personaId: personaXX,
  regimen,
  tipo_dia: "laborable",
  turnoCompuestoId: null,
  origen_segmento: "plan_base",
  indiceCalendario: null,
  segmentosOverride: segmentosCedidos,
  expectativasFichadaExtra: [
    {
      tipo: "salida_momentanea",
      fecha_base: fecha,
      cantidad_fichadas_esperadas: 2,
      patron_esperado: ["egreso", "ingreso"],
      solicitud_id: "sol_smoke_fase_f_001",
    },
  ],
});

const resultado = {
  A_continuo: { esperado: 2, actual: capaA.fichadas_esperadas },
  B_cede_tarde: { esperado: 4, actual: capaB.fichadas_esperadas },
  C_cede_tarde_mas_extra: { esperado: 6, actual: capaC.fichadas_esperadas },
};

console.log(
  JSON.stringify(
    {
      fecha,
      persona_xx: personaXX,
      persona_yy: personaYY,
      segmentos_A: capaA.segmentos?.map((s) => ({
        segmento_id: s.segmento_id,
        ingreso_iso: s.ingreso_iso,
        egreso_iso: s.egreso_iso,
        ejecutante: s.persona_ejecutante_id,
      })) || [],
      segmentos_B: capaB.segmentos?.map((s) => ({
        segmento_id: s.segmento_id,
        ingreso_iso: s.ingreso_iso,
        egreso_iso: s.egreso_iso,
        ejecutante: s.persona_ejecutante_id,
      })) || [],
      resultado,
      ok:
        resultado.A_continuo.actual === resultado.A_continuo.esperado
        && resultado.B_cede_tarde.actual === resultado.B_cede_tarde.esperado
        && resultado.C_cede_tarde_mas_extra.actual === resultado.C_cede_tarde_mas_extra.esperado,
    },
    null,
    2,
  ),
);

if (
  resultado.A_continuo.actual !== resultado.A_continuo.esperado
  || resultado.B_cede_tarde.actual !== resultado.B_cede_tarde.esperado
  || resultado.C_cede_tarde_mas_extra.actual !== resultado.C_cede_tarde_mas_extra.esperado
) {
  throw new Error(
    `Fallo fórmula Fase F: A=${resultado.A_continuo.actual}, B=${resultado.B_cede_tarde.actual}, C=${resultado.C_cede_tarde_mas_extra.actual}`,
  );
}

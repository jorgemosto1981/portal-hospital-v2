/**
 * Smoke local T-03: materialización diaria (sin Firestore).
 * Valida:
 * - Turno compuesto + cruce medianoche a ISO
 * - Cobertura parcial por segmento
 * - Resumen derivado (ingreso/egreso/huecos)
 *
 * Uso: node scripts/smoke-materializar-turno-dia-t03.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildCapaTeoricaSegmentada,
} = require("../functions/modules/asistencia/capaTeoricaSegmentosCore.js");

const fechaYmd = "2026-06-03";
const personaOrigen = "per_01ORIGEN00000000000000000";
const personaCobertura = "per_01COBERT0000000000000000";

const regimenMock = {
  turnos_disponibles: [
    { turno_id: "M", ingreso: "08:00", egreso: "12:00" },
    { turno_id: "T", ingreso: "14:00", egreso: "18:00" },
    { turno_id: "N", ingreso: "22:00", egreso: "06:00" },
  ],
};

const base = buildCapaTeoricaSegmentada({
  fechaYmd,
  personaId: personaOrigen,
  regimen: regimenMock,
  tipo_dia: "laborable",
  turnoCompuestoId: "M+N",
  origen_segmento: "plan_base",
  indiceCalendario: null,
});

const cobertura = {
  tipo: "cobertura_parcial",
  tipo_compensacion_id: "cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH",
  persona_origen_id: personaOrigen,
  persona_cobertura_id: personaCobertura,
  segmentos_cubiertos: ["N"],
};

const segmentosFusionados = (base.segmentos || []).map((seg) => {
  if (!cobertura.segmentos_cubiertos.includes(seg.segmento_id)) return seg;
  return {
    ...seg,
    persona_ejecutante_id: cobertura.persona_cobertura_id,
    origen_segmento: "override_cobertura",
    tipo_compensacion_id: cobertura.tipo_compensacion_id,
  };
});

const final = buildCapaTeoricaSegmentada({
  fechaYmd,
  personaId: personaOrigen,
  regimen: regimenMock,
  tipo_dia: "laborable",
  turnoCompuestoId: null,
  origen_segmento: "plan_base",
  indiceCalendario: null,
  segmentosOverride: segmentosFusionados,
});

console.log("[T-03 smoke] Resultado:");
console.log(JSON.stringify({
  fecha_base: final.fecha_base,
  turno_compuesto_id: final.turno_compuesto_id,
  ingreso_teorico_final: final.ingreso_teorico_final,
  egreso_teorico_final: final.egreso_teorico_final,
  horas_teoricas_totales: final.horas_teoricas_totales,
  tiene_huecos: final.tiene_huecos,
  segmentos: final.segmentos.map((s) => ({
    segmento_id: s.segmento_id,
    ingreso_iso: s.ingreso_iso,
    egreso_iso: s.egreso_iso,
    cruza_medianoche: s.cruza_medianoche,
    persona_titular_id: s.persona_titular_id,
    persona_ejecutante_id: s.persona_ejecutante_id,
    origen_segmento: s.origen_segmento,
    tipo_compensacion_id: s.tipo_compensacion_id,
  })),
}, null, 2));

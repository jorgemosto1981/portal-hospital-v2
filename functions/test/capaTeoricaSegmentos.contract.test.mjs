/**
 * T-02 — Tests de contrato Zod (espejo web ↔ functions JSDoc).
 * node --test functions/test/capaTeoricaSegmentos.contract.test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CAPA_TEORICA_SEGMENTOS_CONTRACT_VERSION,
} from "../modules/asistencia/schemas/capaTeoricaSegmentos.contract.js";
import {
  capaTeoricaSegmentadaSchema,
  coberturaParcialOverrideSchema,
  segmentoTeoricoSchema,
} from "../../web/src/schemas/capaTeoricaSegmentos.schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(join(__dirname, "fixtures/capaTeoricaSegmentos.golden.json"), "utf8"),
);

describe("T-02 capa teórica segmentos — contrato", () => {
  it("versión de contrato alineada al RFC", () => {
    assert.equal(CAPA_TEORICA_SEGMENTOS_CONTRACT_VERSION, "v2.0.0-rfc-turnos-compuestos");
  });

  it("golden laborable un segmento parsea con Zod", () => {
    const parsed = capaTeoricaSegmentadaSchema.parse(golden.laborable_un_segmento);
    assert.equal(parsed.segmentos.length, 1);
    assert.equal(parsed.tipo_dia, "laborable");
  });

  it("golden no laborable sin segmentos", () => {
    const parsed = capaTeoricaSegmentadaSchema.parse(golden.no_laborable_sin_segmentos);
    assert.equal(parsed.segmentos.length, 0);
    assert.equal(parsed.horas_teoricas_totales, 0);
  });

  it("rechaza segmento sin persona_ejecutante_id", () => {
    const bad = structuredClone(golden.laborable_un_segmento);
    delete bad.segmentos[0].persona_ejecutante_id;
    assert.throws(() => capaTeoricaSegmentadaSchema.parse(bad));
  });

  it("cobertura parcial override mínimo válido", () => {
    const ov = coberturaParcialOverrideSchema.parse({
      tipo_override_id: "cfg_tov_01KSN4ZJPXNNGSY07ZVXPQSSE5",
      tipo_compensacion_id: "cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH",
      persona_origen_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      persona_cobertura_id: "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB",
      segmentos_cubiertos: ["cfg_reg_turno_01_manana"],
      motivo: "Cobertura QA T-02",
      es_override_manual: true,
    });
    assert.equal(ov.segmentos_cubiertos.length, 1);
  });

  it("segmento cruza_medianoche default false", () => {
    const seg = segmentoTeoricoSchema.parse({
      segmento_id: "cfg_reg_turno_03_noche",
      ingreso_iso: "2026-06-10T01:00:00.000Z",
      egreso_iso: "2026-06-10T09:00:00.000Z",
      fecha_base: "2026-06-10",
      persona_titular_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      persona_ejecutante_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      origen_segmento: "plan_base",
    });
    assert.equal(seg.cruza_medianoche, false);
  });
});

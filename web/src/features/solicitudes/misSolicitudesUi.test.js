import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bucketEstadoSolicitud,
  chipToneEstado,
  estaDentroHistorico3Meses,
  labelEstadoSolicitudAgente,
  ymdCorteHistorico3Meses,
} from "./misSolicitudesUi.js";

describe("misSolicitudesUi", () => {
  it("mapea buckets", () => {
    assert.equal(bucketEstadoSolicitud("cfg_esa_aprobada"), "autorizada");
    assert.equal(bucketEstadoSolicitud("cfg_esa_rechazada"), "rechazada");
    assert.equal(bucketEstadoSolicitud("cfg_esa_cancelada"), "rechazada");
    assert.equal(bucketEstadoSolicitud("cfg_esa_en_revision_jefe"), "pendiente");
    assert.equal(bucketEstadoSolicitud("cfg_esa_aprobada_pendiente_aplicacion"), "pendiente");
    assert.equal(bucketEstadoSolicitud("cfg_esa_pendiente_clasificacion_medica"), "pendiente");
  });

  it("chip cancelada neutro vs rechazo rose", () => {
    assert.equal(chipToneEstado("cfg_esa_cancelada"), "slate");
    assert.equal(chipToneEstado("cfg_esa_rechazada"), "rose");
  });

  it("labels LM legibles", () => {
    assert.match(
      labelEstadoSolicitudAgente("cfg_esa_pendiente_clasificacion_medica"),
      /clasificación médica/i,
    );
  });

  it("histórico 3 meses inclusivo (hoy 14-jul-2026 → corte 14-abr)", () => {
    const now = new Date("2026-07-14T15:00:00-03:00");
    assert.equal(ymdCorteHistorico3Meses(now), "2026-04-14");
    assert.equal(estaDentroHistorico3Meses("2026-04-14T12:00:00.000Z", now), true);
    assert.equal(estaDentroHistorico3Meses("2026-04-10T12:00:00.000Z", now), false);
    assert.equal(estaDentroHistorico3Meses("2026-04-01T12:00:00.000Z", now), false);
  });
});

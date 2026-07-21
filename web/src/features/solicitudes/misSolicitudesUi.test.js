import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bucketEstadoSolicitud,
  chipToneEstado,
  esSolicitudInasistenciaInjustificadaDerivada,
  estaDentroHistorico3Meses,
  labelEstadoSolicitudAgente,
  relatoRechazoConInasistenciaInjustificada,
  requiereAcuseSinGoce,
  tipoAcusePendiente,
  tituloSolicitudAgente,
  ymdCorteHistorico3Meses,
} from "./misSolicitudesUi.js";

describe("misSolicitudesUi", () => {
  it("mapea buckets", () => {
    assert.equal(bucketEstadoSolicitud("cfg_esa_aprobada"), "autorizada");
    assert.equal(bucketEstadoSolicitud("cfg_esa_rechazada"), "rechazada");
    assert.equal(
      bucketEstadoSolicitud("cfg_esa_rechazada", { decision_jefe_ui: "observado" }),
      "observada",
    );
    assert.equal(bucketEstadoSolicitud("cfg_esa_cancelada"), "rechazada");
    assert.equal(bucketEstadoSolicitud("cfg_esa_en_revision_jefe"), "pendiente");
    assert.equal(bucketEstadoSolicitud("cfg_esa_aprobada_pendiente_aplicacion"), "pendiente");
    assert.equal(bucketEstadoSolicitud("cfg_esa_pendiente_clasificacion_medica"), "pendiente");
  });

  it("chip cancelada neutro vs rechazo rose vs observado amber", () => {
    assert.equal(chipToneEstado("cfg_esa_cancelada"), "slate");
    assert.equal(chipToneEstado("cfg_esa_rechazada"), "rose");
    assert.equal(
      chipToneEstado("cfg_esa_rechazada", { decision_jefe_ui: "observado" }),
      "amber",
    );
  });

  it("labels LM legibles", () => {
    assert.match(
      labelEstadoSolicitudAgente("cfg_esa_pendiente_clasificacion_medica"),
      /clasificación médica/i,
    );
  });

  it("Art. 63 Observado: chip Observada (no Rechazada)", () => {
    assert.equal(labelEstadoSolicitudAgente("cfg_esa_rechazada"), "Rechazada");
    assert.equal(
      labelEstadoSolicitudAgente("cfg_esa_rechazada", { decision_jefe_ui: "observado" }),
      "Observada",
    );
    assert.equal(
      labelEstadoSolicitudAgente("cfg_esa_rechazada", { decision_jefe_ui: "rechazar" }),
      "Rechazada",
    );
  });

  it("histórico 3 meses inclusivo (hoy 14-jul-2026 → corte 14-abr)", () => {
    const now = new Date("2026-07-14T15:00:00-03:00");
    assert.equal(ymdCorteHistorico3Meses(now), "2026-04-14");
    assert.equal(estaDentroHistorico3Meses("2026-04-14T12:00:00.000Z", now), true);
    assert.equal(estaDentroHistorico3Meses("2026-04-10T12:00:00.000Z", now), false);
    assert.equal(estaDentroHistorico3Meses("2026-04-01T12:00:00.000Z", now), false);
  });

  it("77-0 derivado: título sin código y relato de rechazo", () => {
    const hija = {
      articulo_id: "art_01KXK3HN7Z52Q0TKPM5EE6Y0M7",
      codigo_grilla: "77-0",
      origen_rechazo_sol_id: "sol_01KXR0EF7NWD5VD6WCAEYB2ST2",
    };
    assert.equal(esSolicitudInasistenciaInjustificadaDerivada(hija), true);
    assert.equal(tituloSolicitudAgente(hija), "Inasistencia injustificada");

    const padre = {
      art_77_0_derivada_id: "sol_01KXR0JKX27MVMDDSM0KPEJ373",
    };
    const relato = relatoRechazoConInasistenciaInjustificada(
      padre,
      "64-A — ASUNTOS PARTICULARES CON GOCE DE HABERES",
    );
    assert.match(relato, /Pediste 64-A/i);
    assert.match(relato, /inasistencia injustificada/i);
    assert.doesNotMatch(relato, /77-0/);
  });

  it("64 sin goce: título informa sin goce de haberes", () => {
    assert.match(
      tituloSolicitudAgente({
        articulo_id: "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ",
        codigo_grilla: "64-B",
        modalidad_goce_jefe: "sin_goce",
      }),
      /sin goce de haberes/i,
    );
    assert.match(
      tituloSolicitudAgente({
        articulo_id: "art_01KRNK10V10CH7W5M2W6V558GS",
        modalidad_goce_jefe: "con_goce",
      }),
      /con goce de haberes/i,
    );
  });

  it("acuse sin goce: solo aprobada + modalidad sin_goce sin acuse", () => {
    const base = {
      estado_solicitud_id: "cfg_esa_aprobada",
      modalidad_goce_jefe: "sin_goce",
      creado_en: "2026-07-17T12:00:00.000Z",
    };
    assert.equal(requiereAcuseSinGoce(base), true);
    assert.equal(tipoAcusePendiente(base), "sin_goce");
    assert.equal(
      requiereAcuseSinGoce({ ...base, agente_acuse_sin_goce_en: { seconds: 1 } }),
      false,
    );
    assert.equal(
      requiereAcuseSinGoce({ ...base, modalidad_goce_jefe: "con_goce" }),
      false,
    );
    assert.equal(
      requiereAcuseSinGoce({ ...base, estado_solicitud_id: "cfg_esa_rechazada" }),
      false,
    );
  });
});

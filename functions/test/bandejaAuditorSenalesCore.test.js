"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  calcularPlazoProvisorioSenal,
  compararBandejaAuditorProvisoriasPorUrgencia,
  resolverBadgesBandejaAuditor,
} = require("../modules/shared/bandejaAuditorSenalesCore.js");

describe("bandejaAuditorSenalesCore (shared)", () => {
  const ahora = Date.parse("2026-08-28T12:00:00.000Z");

  it("completa → badge lista", () => {
    const badges = resolverBadgesBandejaAuditor(
      { es_licencia_incompleta: false, puede_clasificar: true },
      ahora,
    );
    assert.ok(badges.some((b) => b.id === "lista"));
  });

  it("provisoria vencida → badge vencida + nivel vencida", () => {
    const item = {
      es_licencia_incompleta: true,
      vencimiento_plazo_certificado: new Date(ahora - 60_000).toISOString(),
    };
    const plazo = calcularPlazoProvisorioSenal(item, ahora);
    assert.equal(plazo.vencida, true);
    assert.ok(resolverBadgesBandejaAuditor(item, ahora).some((b) => b.id === "vencida"));
  });

  it("compararBandejaAuditorProvisoriasPorUrgencia prioriza vencida", () => {
    const vencida = {
      es_licencia_incompleta: true,
      vencimiento_plazo_certificado: new Date(ahora - 1000).toISOString(),
    };
    const holgada = {
      es_licencia_incompleta: true,
      vencimiento_plazo_certificado: new Date(ahora + 10 * 86400000).toISOString(),
    };
    assert.ok(compararBandejaAuditorProvisoriasPorUrgencia(vencida, holgada, ahora) < 0);
  });
});

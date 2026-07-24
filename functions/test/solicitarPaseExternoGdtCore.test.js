"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  solicitarPaseExternoGdtCore,
} = require("../modules/organizacion/solicitarPaseExternoGdtCore");

describe("solicitarPaseExternoGdtCore", () => {
  it("valida campos obligatorios sin tocar Firestore", async () => {
    const r = await solicitarPaseExternoGdtCore(/** @type {any} */ (null), {
      agentePersonaId: "per_01TESTAGENTE0000000000000",
      hlgOrigenId: "hlg_01TESTORIGEN00000000000000",
      fechaEfectivaYmd: "2026-07-24",
      motivo: "motivo valido",
      destinoSugeridoTexto: "",
      solicitantePersonaId: "per_01TESTJEFE000000000000000",
      esRrhh: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid-argument");
    assert.match(String(r.message || ""), /destino_sugerido/i);
  });

  it("bloquea auto-solicitud aunque sea RRHH", async () => {
    const r = await solicitarPaseExternoGdtCore(/** @type {any} */ (null), {
      agentePersonaId: "per_01TESTAGENTE0000000000000",
      hlgOrigenId: "hlg_01TESTORIGEN00000000000000",
      fechaEfectivaYmd: "2026-07-24",
      motivo: "motivo valido",
      destinoSugeridoTexto: "Otro servicio sugerido",
      solicitantePersonaId: "per_01TESTAGENTE0000000000000",
      esRrhh: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "failed-precondition");
    assert.match(String(r.message || ""), /vos mismo/i);
  });
});

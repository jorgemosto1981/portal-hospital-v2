"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { hlgVigenteEnFecha } = require("../modules/shared/solicitudHlgVigencia");

describe("hlgVigenteEnFecha — corte inclusivo con activo false", () => {
  const hlgCerrada = {
    activo: false,
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-06-01",
    grupo_de_trabajo_id: "gdt_01KQA9FVEW53JSNTPGX32NWQ5B",
  };

  it("último día de corte sigue vigente para solicitud", () => {
    assert.equal(hlgVigenteEnFecha(hlgCerrada, "2026-06-01"), true);
  });

  it("día posterior al corte no vigente", () => {
    assert.equal(hlgVigenteEnFecha(hlgCerrada, "2026-06-02"), false);
  });

  it("activo true en rango", () => {
    assert.equal(
      hlgVigenteEnFecha(
        { activo: true, fecha_inicio: "2026-01-01", fecha_fin: null },
        "2026-06-01",
      ),
      true,
    );
  });

  it("activo false sin fecha_fin no vigente", () => {
    assert.equal(
      hlgVigenteEnFecha({ activo: false, fecha_inicio: "2026-01-01" }, "2026-06-01"),
      false,
    );
  });
});

"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  registrarAcuseRechazoAgente,
  registrarAcuseSinGoceAgente,
} = require("./solicitudAcuseRechazoAgenteCore");

function makeDb({ sol }) {
  return {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return {
                exists: Boolean(sol),
                data: () => (sol ? { ...sol } : undefined),
              };
            },
            async update(patch) {
              Object.assign(sol, patch);
              return patch;
            },
          };
        },
      };
    },
  };
}

describe("registrarAcuseRechazoAgente", () => {
  it("rechaza si no es titular", async () => {
    const sol = {
      titular_persona_id: "per_A",
      estado_solicitud_id: "cfg_esa_rechazada",
    };
    const r = await registrarAcuseRechazoAgente(makeDb({ sol }), "sol_1", "per_B");
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "FORBIDDEN");
  });

  it("idempotente si ya acusó", async () => {
    const sol = {
      titular_persona_id: "per_A",
      estado_solicitud_id: "cfg_esa_rechazada",
      agente_acuse_rechazo_en: { seconds: 1 },
    };
    const r = await registrarAcuseRechazoAgente(makeDb({ sol }), "sol_1", "per_A");
    assert.equal(r.ok, true);
    assert.equal(r.idempotente, true);
  });

  it("escribe campos de acuse", async () => {
    const sol = {
      titular_persona_id: "per_A",
      estado_solicitud_id: "cfg_esa_rechazada",
      articulo_id: "art_x",
    };
    const r = await registrarAcuseRechazoAgente(
      makeDb({ sol }),
      "sol_01KWWMD50C6BS1DB302EX9DM2E",
      "per_A",
    );
    assert.equal(r.ok, true);
    assert.equal(sol.agente_acuse_rechazo_persona_id, "per_A");
    assert.ok(sol.agente_acuse_rechazo_en);
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe("registrarAcuseSinGoceAgente", () => {
  it("rechaza si no es autorización sin goce", async () => {
    const sol = {
      titular_persona_id: "per_A",
      estado_solicitud_id: "cfg_esa_aprobada",
      modalidad_goce_jefe: "con_goce",
    };
    const r = await registrarAcuseSinGoceAgente(makeDb({ sol }), "sol_1", "per_A");
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "ESTADO_INVALIDO");
  });

  it("escribe campos de acuse sin goce", async () => {
    const sol = {
      titular_persona_id: "per_A",
      estado_solicitud_id: "cfg_esa_aprobada",
      modalidad_goce_jefe: "sin_goce",
      articulo_id: "art_64b",
    };
    const r = await registrarAcuseSinGoceAgente(makeDb({ sol }), "sol_sg", "per_A");
    assert.equal(r.ok, true);
    assert.equal(sol.agente_acuse_sin_goce_persona_id, "per_A");
    assert.ok(sol.agente_acuse_sin_goce_en);
    await new Promise((r) => setTimeout(r, 50));
  });
});

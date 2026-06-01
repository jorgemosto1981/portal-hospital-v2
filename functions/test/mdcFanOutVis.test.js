/**
 * node --test functions/test/mdcFanOutVis.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { resolverGruposFanOut } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/mdcFanOutVis.js"),
);

describe("mdcFanOutVis", () => {
  it("resolverGruposFanOut prioriza snapshot involucrados", () => {
    const g = resolverGruposFanOut({
      grupos_trabajo_involucrados_ids: ["gdt_A", "gdt_B"],
      grupo_trabajo_id_ancla: "gdt_A",
    });
    assert.deepEqual(g, ["gdt_A", "gdt_B"]);
  });

  it("evento proyectado incluye grupo_trabajo_id_ancla (contrato)", () => {
    const ancla = "gdt_01KR3H81ENQK84ZK21EQWEQQXG";
    const evento = {
      solicitud_id: "sol_test",
      codigo_grilla: "68-B",
      grupo_trabajo_id_ancla: ancla,
    };
    assert.equal(evento.grupo_trabajo_id_ancla, ancla);
  });
});

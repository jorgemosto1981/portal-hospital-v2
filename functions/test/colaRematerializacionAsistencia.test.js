/**
 * node --test functions/test/colaRematerializacionAsistencia.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  buildColaRematDocId,
  ejecutarRematerializacionDesdeCola,
} = require(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../modules/asistencia/colaRematerializacionAsistenciaCore.js",
  ),
);

describe("cola_rematerializacion_asistencia (outbox fichadas → materializar)", () => {
  it("buildColaRematDocId es estable por persona/gdt/fecha", () => {
    const id = buildColaRematDocId("per_abc", "gdt_xyz", "2026-06-12");
    assert.equal(id, "remat_2026_06_12_per_per_abc_gdt_gdt_xyz");
    assert.equal(
      buildColaRematDocId("per_abc", "gdt_xyz", "2026-06-12"),
      id,
    );
    assert.notEqual(
      buildColaRematDocId("per_abc", "gdt_xyz", "2026-06-13"),
      id,
    );
  });

  it("ejecutarRematerializacionDesdeCola invoca materializar con parámetros del payload", async () => {
    const llamadas = [];
    const r = await ejecutarRematerializacionDesdeCola(
      {
        persona_id: "per_demo",
        gdt_id: "gdt_demo",
        fecha_ymd: "2026-06-12",
        procesado: false,
      },
      async (args) => {
        llamadas.push(args);
        return { ok: true, diasProcesados: 1 };
      },
    );
    assert.equal(r.ok, true);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0], {
      personaId: "per_demo",
      grupoId: "gdt_demo",
      fechaYmd: "2026-06-12",
    });
  });

  it("omite ítems ya marcados procesado", async () => {
    let n = 0;
    const r = await ejecutarRematerializacionDesdeCola(
      {
        persona_id: "per_demo",
        gdt_id: "gdt_demo",
        fecha_ymd: "2026-06-12",
        procesado: true,
      },
      async () => {
        n += 1;
        return { ok: true };
      },
    );
    assert.equal(r.omitido, true);
    assert.equal(n, 0);
  });
});

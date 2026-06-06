import { describe, expect, it } from "vitest";
import seedIds from "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json" with { type: "json" };
import {
  MANIFIESTO_A0,
  parseListarCatalogosAsistenciaTurnosResponse,
} from "./cfgAsistenciaTurnos.schema.js";

function buildFixture() {
  const catalogos = {};
  for (const [col, map] of Object.entries(seedIds)) {
    if (!col.startsWith("cfg_")) continue;
    let orden = 0;
    catalogos[col] = Object.entries(map).map(([codigo_interno, id]) => {
      orden += 10;
      return { id, codigo_interno, titulo_ui: codigo_interno, orden };
    });
  }
  return { ok: true, catalogos };
}

describe("cfgAsistenciaTurnos.schema", () => {
  it("aprueba fixture A0 y coincide con manifiesto", () => {
    const parsed = parseListarCatalogosAsistenciaTurnosResponse(buildFixture());
    expect(parsed.catalogos.cfg_tipo_compensacion_cobertura).toHaveLength(3);
    expect(parsed.catalogos.cfg_estado_periodo_liquidacion).toHaveLength(3);
    expect(parsed.catalogos.cfg_clasificacion_dia_calendario).toHaveLength(5);
    expect(parsed.catalogos.cfg_tipo_override_turno).toHaveLength(1);
    for (const [col, ids] of Object.entries(MANIFIESTO_A0)) {
      const got = parsed.catalogos[col].map((i) => i.id).sort();
      expect(got).toEqual([...ids].sort());
    }
  });

  it("rechaza id fuera del manifiesto", () => {
    const bad = buildFixture();
    bad.catalogos.cfg_tipo_compensacion_cobertura[0].id = "cfg_tcc_INVALID";
    expect(() => parseListarCatalogosAsistenciaTurnosResponse(bad)).toThrow();
  });
});

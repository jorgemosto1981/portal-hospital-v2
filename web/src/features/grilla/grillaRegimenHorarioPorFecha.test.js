import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  regimenHorarioIdParaFecha,
  personasConRegimenEnFecha,
} from "./grillaRegimenHorarioPorFecha.js";

const REG_MTN = "cfg_regimen_mtn";
const REG_JV = "cfg_regimen_jv";

describe("grillaRegimenHorarioPorFecha", () => {
  const personasGrupo = [
    {
      persona_id: "per_most",
      hlg_id: "hlg_oficina",
      regimen_horario_id: REG_JV,
      vigente_desde: "2026-06-01",
      vigente_hasta: "2026-06-15",
      persona_label: "MOSTO · JV",
    },
    {
      persona_id: "per_most",
      hlg_id: "hlg_sala",
      regimen_horario_id: REG_MTN,
      vigente_desde: "2026-06-16",
      vigente_hasta: "2026-06-30",
      persona_label: "MOSTO · Sala",
    },
    {
      persona_id: "per_chap",
      hlg_id: "hlg_sala",
      regimen_horario_id: REG_MTN,
      vigente_desde: "2026-06-01",
      vigente_hasta: "2026-06-30",
      persona_label: "CHAPARRO",
    },
  ];

  it("elige régimen del tramo HLg vigente en la fecha (no el primer tramo del mes)", () => {
    assert.equal(regimenHorarioIdParaFecha(personasGrupo, "per_most", "2026-06-10"), REG_JV);
    assert.equal(regimenHorarioIdParaFecha(personasGrupo, "per_most", "2026-06-20"), REG_MTN);
    assert.equal(regimenHorarioIdParaFecha(personasGrupo, "per_chap", "2026-06-20"), REG_MTN);
  });

  it("personasConRegimenEnFecha empareja por fecha destino", () => {
    const pares = personasConRegimenEnFecha(personasGrupo, "2026-06-20", "per_chap").filter(
      (p) => p.persona_id === "per_most",
    );
    assert.equal(pares.length, 1);
    assert.equal(pares[0].regimen_horario_id, REG_MTN);
  });
});

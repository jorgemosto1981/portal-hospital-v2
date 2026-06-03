import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatFechaOutboxCorta,
  personaEtiquetaOutbox,
  resumenLineaOutboxOp,
  tipoFlujoOutbox,
} from "./grillaOutboxLabels.js";

const TURNOS = {
  cfg_reg_turno_m: { codigo_interno: "M" },
  cfg_reg_turno_n: { codigo_interno: "N" },
};

const LABELS = {
  per_xx: "MOSTO, JORGE",
  per_yy: "PEREZ, ANA",
};

describe("grillaOutboxLabels", () => {
  it("formatFechaOutboxCorta DD/MM", () => {
    assert.equal(formatFechaOutboxCorta("2026-06-05"), "05/06");
  });

  it("personaEtiquetaOutbox usa apellido del mapa", () => {
    assert.equal(personaEtiquetaOutbox("per_xx", LABELS), "MOSTO");
  });

  it("Flujo A v2 bilateral", () => {
    const linea = resumenLineaOutboxOp({
      tipo: "cobertura_parcial",
      personaOrigenId: "per_xx",
      personaDestinoId: "per_yy",
      fechaOrigenYmd: "2026-06-05",
      fechaDestinoYmd: "2026-06-12",
      segmentosCedidosOrigen: ["cfg_reg_turno_n"],
      segmentosCedidosDestino: ["cfg_reg_turno_m"],
    }, { personaLabels: LABELS, turnosPorId: TURNOS });
    assert.match(linea, /MOSTO 05\/06 cede N ↔ PEREZ 12\/06 cede M/);
  });

  it("Flujo B v2 traslado", () => {
    const linea = resumenLineaOutboxOp({
      tipo: "reemplazo",
      personaId: "per_xx",
      fechaOrigenYmd: "2026-06-05",
      fechaDestinoYmd: "2026-06-10",
      segmentosTrasladar: ["cfg_reg_turno_m"],
      segmentosIncorporadosDestino: ["cfg_reg_turno_n"],
      francoEnOrigen: true,
    }, { personaLabels: LABELS, turnosPorId: TURNOS });
    assert.match(linea, /MOSTO: quita M \(05\/06\) → suma N \(10\/06\) · origen franco/);
  });

  it("Flujo C v2 adicional con snapshot", () => {
    const linea = resumenLineaOutboxOp({
      tipo: "adicional",
      personaId: "per_xx",
      fechaYmd: "2026-06-13",
      turnoId: "cfg_reg_turno_n",
      motivo: "Refuerzo",
      estadoPrevio: {
        es_franco: false,
        es_feriado: false,
        etiqueta_preasignada: "M",
        horas_preasignadas: 8,
      },
    }, { personaLabels: LABELS, turnosPorId: TURNOS });
    assert.match(linea, /MOSTO · 13\/06 · M · extra \+N/);
  });

  it("tipoFlujoOutbox", () => {
    assert.equal(tipoFlujoOutbox({ tipo: "adicional" }).letra, "C");
  });
});

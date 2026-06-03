import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  agruparOpsOutboxPorTarjeta,
  agruparOpsOutboxPorTitulo,
  formatFechaOutboxCorta,
  labelPeriodoOutbox,
  mergePersonaLabelsDesdeOps,
  outboxOpId,
  personaEtiquetaOutbox,
  resumenLineaOutboxOp,
  tipoFlujoOutbox,
  tituloGrupoOutboxOp,
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

  it("personaEtiquetaOutbox prioriza etiqueta directa de la op", () => {
    assert.equal(personaEtiquetaOutbox("per_xx", {}, "LOKITO, JUAN"), "LOKITO");
  });

  it("mergePersonaLabelsDesdeOps extrae nombres embebidos", () => {
    const merged = mergePersonaLabelsDesdeOps([
      {
        personaOrigenId: "per_a",
        personaOrigenLabel: "MOSTO, JORGE",
        personaDestinoId: "per_b",
        personaDestinoLabel: "PEREZ, ANA",
      },
    ]);
    assert.equal(merged.per_a, "MOSTO, JORGE");
    assert.equal(merged.per_b, "PEREZ, ANA");
  });

  it("Flujo A v2 bilateral", () => {
    const linea = resumenLineaOutboxOp({
      tipo: "cobertura_parcial",
      personaOrigenId: "per_xx",
      personaDestinoId: "per_yy",
      personaOrigenLabel: "MOSTO, JORGE",
      personaDestinoLabel: "PEREZ, ANA",
      fechaOrigenYmd: "2026-06-05",
      fechaDestinoYmd: "2026-06-12",
      segmentosCedidosOrigen: ["cfg_reg_turno_n"],
      segmentosCedidosDestino: ["cfg_reg_turno_m"],
    }, { turnosPorId: TURNOS });
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

  it("tipoFlujoOutbox usa titulo de funcion", () => {
    assert.equal(tipoFlujoOutbox({ tipo: "cobertura_parcial" }).titulo, "Intercambio de guardia");
    assert.equal(tipoFlujoOutbox({ tipo: "adicional" }).titulo, "Horas adicionales");
  });

  it("agruparOpsOutboxPorTitulo ordena A B C", () => {
    const grupos = agruparOpsOutboxPorTitulo([
      { id: "1", tipo: "adicional", personaId: "per_x", fechaYmd: "2026-06-04", turnoId: "cfg_reg_turno_m", motivo: "x", estadoPrevio: { es_franco: true } },
      { id: "2", tipo: "cobertura_parcial", personaOrigenId: "per_a", personaDestinoId: "per_b", fechaOrigenYmd: "2026-06-01", fechaDestinoYmd: "2026-06-02", segmentosCedidosOrigen: ["cfg_reg_turno_m"], segmentosCedidosDestino: ["cfg_reg_turno_n"] },
    ]);
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].titulo, "Intercambio de guardia");
    assert.equal(grupos[1].titulo, "Horas adicionales");
  });

  it("agruparOpsOutboxPorTarjeta separa grupo y periodo", () => {
    const tarjetas = agruparOpsOutboxPorTarjeta([
      { id: "1", tipo: "adicional", grupoId: "gdt_a", periodo: "2026-06", personaId: "per_x", fechaYmd: "2026-06-04", turnoId: "cfg_reg_turno_m", motivo: "x", estadoPrevio: { es_franco: true } },
      { id: "2", tipo: "cobertura_parcial", grupoId: "gdt_b", periodo: "2026-06", personaOrigenId: "per_a", personaDestinoId: "per_b", fechaOrigenYmd: "2026-06-01", fechaDestinoYmd: "2026-06-02", segmentosCedidosOrigen: ["cfg_reg_turno_m"], segmentosCedidosDestino: ["cfg_reg_turno_n"] },
      { id: "3", tipo: "reemplazo", grupoId: "gdt_a", periodo: "2026-07", personaId: "per_c", fechaOrigenYmd: "2026-07-01", fechaDestinoYmd: "2026-07-02", segmentosTrasladar: ["cfg_reg_turno_m"], turnoIdDestino: "cfg_reg_turno_n" },
    ]);
    assert.equal(tarjetas.length, 3);
    assert.equal(tarjetas[0].grupoId, "gdt_a");
    assert.equal(tarjetas[0].periodo, "2026-06");
    assert.equal(tarjetas[2].periodo, "2026-07");
  });

  it("labelPeriodoOutbox y tituloGrupoOutboxOp", () => {
    assert.match(labelPeriodoOutbox("2026-06"), /junio/i);
    assert.equal(
      tituloGrupoOutboxOp({ grupoId: "gdt_x" }, { gdt_x: "Sala Junín" }),
      "Sala Junín",
    );
    assert.equal(tituloGrupoOutboxOp({ grupoLabel: "Guardia" }), "Guardia");
    assert.equal(tituloGrupoOutboxOp({}), "Titular (mi caso)");
  });
});

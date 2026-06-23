import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validarAdicionalCN1,
  validarAdicionalTurno,
  validarTopeHorasPostAdicional,
  buildAdicionalOutboxOp,
  esAdicionalV2,
  esFeriadoDesdeCapa,
  capaTieneTeoricoLaborable,
  turnosAdicionablesEnDia,
  capturarEstadoPrevioDia,
  horasAdicionalesDelTurno,
} from "./grillaAdicionalPreview.js";

const PER = "per_test";
const FECHA = "2026-06-10";
const PERIODO = "2026-06";

const TURNOS = {
  cfg_reg_turno_m: { horas_efectivas: 8, codigo_interno: "M" },
  cfg_reg_turno_t: { horas_efectivas: 8, codigo_interno: "T" },
  cfg_reg_turno_n: { horas_efectivas: 8, codigo_interno: "N" },
};

function capaLaborable(ids) {
  return {
    tipo_dia: "laborable",
    segmentos: ids.map((id) => ({ segmento_id: id, horas_efectivas: 8 })),
    horas_teoricas_totales: ids.length * 8,
  };
}

describe("grillaAdicionalPreview", () => {
  it("C-N1 rechaza agregar M si el teórico ya tiene M", () => {
    const capa = capaLaborable(["cfg_reg_turno_m"]);
    const r = validarAdicionalCN1("cfg_reg_turno_m", capa, capa.segmentos.map((s) => s.segmento_id), TURNOS);
    assert.equal(r.ok, false);
    assert.match(r.error || "", /M/i);
  });

  it("C-N1 permite agregar N si el teórico tiene M", () => {
    const capa = capaLaborable(["cfg_reg_turno_m"]);
    const r = validarAdicionalCN1("cfg_reg_turno_n", capa, ["cfg_reg_turno_m"], TURNOS);
    assert.equal(r.ok, true);
  });

  it("C-N1 no aplica en franco sin teórico laborable", () => {
    const capa = { tipo_dia: "franco", segmentos: [] };
    assert.equal(capaTieneTeoricoLaborable(capa), false);
    const r = validarAdicionalCN1("cfg_reg_turno_m", capa, [], TURNOS);
    assert.equal(r.ok, true);
  });

  it("C-SNAPSHOT franco: horas preasignadas 0", () => {
    const capa = { tipo_dia: "franco", segmentos: [] };
    const st = capturarEstadoPrevioDia(capa, TURNOS);
    assert.equal(st.es_franco, true);
    assert.equal(st.horas_preasignadas, 0);
    assert.equal(st.turno_preasignado_id, null);
  });

  it("C-SNAPSHOT feriado con M: preasignado 8h", () => {
    const capa = {
      tipo_dia: "laborable",
      es_feriado: true,
      segmentos: [{ segmento_id: "cfg_reg_turno_m", horas_efectivas: 8 }],
      horas_teoricas_totales: 8,
    };
    const st = capturarEstadoPrevioDia(capa, TURNOS);
    assert.equal(st.es_feriado, true);
    assert.equal(st.horas_preasignadas, 8);
    assert.equal(st.turno_preasignado_id, "cfg_reg_turno_m");
    assert.equal(st.etiqueta_preasignada, "M");
  });

  it("C-N1 rechaza turno ya sumado en borrador adicional pendiente", () => {
    const capa = capaLaborable(["cfg_reg_turno_m"]);
    const ops = [
      {
        tipo: "adicional",
        personaId: PER,
        fechaYmd: FECHA,
        turnoId: "cfg_reg_turno_n",
      },
    ];
    const val = validarAdicionalTurno({
      turnoId: "cfg_reg_turno_n",
      capa,
      personaId: PER,
      fechaYmd: FECHA,
      periodo: PERIODO,
      turnosPorId: TURNOS,
      opsPendientes: ops,
      motivo: "Refuerzo guardia",
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /N/i);
  });

  it("C-N2 rechaza tope 24 h al agregar turno", () => {
    const capa = capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"]);
    const r = validarTopeHorasPostAdicional(24, "cfg_reg_turno_m", TURNOS, capa.segmentos);
    assert.equal(r.ok, false);
    assert.match(r.error || "", /24/);
  });

  it("validarAdicionalTurno captura snapshot sin horas extra declaradas al jefe", () => {
    const capa = {
      tipo_dia: "laborable",
      es_feriado: true,
      segmentos: [{ segmento_id: "cfg_reg_turno_m", horas_efectivas: 8 }],
      horas_teoricas_totales: 8,
    };
    assert.equal(esFeriadoDesdeCapa(capa), true);
    const val = validarAdicionalTurno({
      turnoId: "cfg_reg_turno_n",
      capa,
      personaId: PER,
      fechaYmd: FECHA,
      periodo: PERIODO,
      turnosPorId: TURNOS,
      motivo: "Guardia feriado",
    });
    assert.equal(val.ok, true);
    assert.equal(val.estadoPrevio.horas_preasignadas, 8);
    assert.equal(val.estadoPrevio.es_feriado, true);
    assert.equal(val.etiquetaAdicional, "+ N");
    assert.equal(val.horasAdicionalesSolicitadas, undefined);
  });

  it("turnosAdicionablesEnDia excluye tramos ya presentes", () => {
    const capa = capaLaborable(["cfg_reg_turno_m"]);
    const { opciones } = turnosAdicionablesEnDia({
      capa,
      personaId: PER,
      fechaYmd: FECHA,
      turnosPorId: TURNOS,
    });
    const ids = opciones.map((o) => o.turno_id);
    assert.ok(!ids.includes("cfg_reg_turno_m"));
    assert.ok(ids.includes("cfg_reg_turno_t"));
    assert.ok(ids.includes("cfg_reg_turno_n"));
    assert.equal(opciones.find((o) => o.turno_id === "cfg_reg_turno_n")?.horas_adicionales, undefined);
  });

  it("buildAdicionalOutboxOp empaqueta snapshot §3.3 sin horas imputadas ni extra declaradas", () => {
    const estadoPrevio = {
      es_franco: false,
      es_feriado: true,
      es_no_laborable: false,
      tipo_dia: "laborable",
      turno_preasignado_id: "cfg_reg_turno_m",
      segmentos_preasignados: ["cfg_reg_turno_m"],
      etiqueta_preasignada: "M",
      horas_preasignadas: 8,
    };
    const op = buildAdicionalOutboxOp({
      personaId: PER,
      fechaYmd: FECHA,
      turnoId: "cfg_reg_turno_n",
      motivo: "Refuerzo pediátrica",
      expectedVersionToken: "tok_1",
      grupoId: "gdt_x",
      periodo: PERIODO,
      estadoPrevio,
    });
    assert.ok(esAdicionalV2(op));
    assert.equal(op.turnoId, "cfg_reg_turno_n");
    assert.equal(op.horasAdicionalesSolicitadas, undefined);
    assert.deepEqual(op.estadoPrevio, estadoPrevio);
    assert.equal(op.esFeriado, true);
    assert.equal(op.horas_efectivas, undefined);
    assert.equal(horasAdicionalesDelTurno("cfg_reg_turno_n", TURNOS), 8);
  });

  it("validarAdicionalTurno modo preasignado acepta tramo del teórico", () => {
    const capa = capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_n"]);
    const val = validarAdicionalTurno({
      turnoId: "cfg_reg_turno_m",
      capa,
      personaId: PER,
      fechaYmd: FECHA,
      periodo: PERIODO,
      turnosPorId: TURNOS,
      motivo: "Cumplimiento fichada M",
      modoDeclaracion: "preasignado",
    });
    assert.equal(val.ok, true);
    assert.equal(val.estadoPrevio.declaracion_tramo_preasignado, true);
    assert.equal(val.modoDeclaracion, "preasignado");
  });

  it("rechaza motivo corto", () => {
    const val = validarAdicionalTurno({
      turnoId: "cfg_reg_turno_n",
      capa: capaLaborable(["cfg_reg_turno_m"]),
      personaId: PER,
      fechaYmd: FECHA,
      turnosPorId: TURNOS,
      motivo: "ab",
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /Motivo/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  estadoDestinoConPreview,
  proyectarDiaConOpsPendientes,
  validarTrasladoPropioDestino,
  validarIncorporacionDestino,
  validarIncorporacionDestinoMultiple,
  turnosIncorporablesEnDestino,
  resolverOpcionesDestinoTraslado,
  resolverCompuestoRegimenParaIncorporacion,
  origenQuedaFrancoCompleto,
  etiquetaSaldoOrigenTrasTraslado,
  mensajeErrorColisionDestino,
  esReemplazoPropioV2,
  buildReemplazoPropioOutboxOp,
  TOPE_HORAS_DIA,
} from "./grillaCambioTurnoPropioPreview.js";

const PER = "per_test";
const FECHA = "2026-06-10";
const FECHA2 = "2026-06-15";

const TURNOS = {
  cfg_reg_turno_m: { horas_efectivas: 8, codigo_interno: "M" },
  cfg_reg_turno_t: { horas_efectivas: 8, codigo_interno: "T" },
  cfg_reg_turno_n: { horas_efectivas: 8, codigo_interno: "N" },
};

describe("grillaCambioTurnoPropioPreview", () => {
  it("estadoDestinoConPreview suma varios segmentosIncorporadosDestino en borrador", () => {
    const capa = {
      segmentos: [{ segmento_id: "cfg_reg_turno_m", horas_efectivas: 8 }],
      horas_teoricas_totales: 8,
    };
    const ops = [
      {
        tipo: "reemplazo",
        personaId: PER,
        fechaDestinoYmd: FECHA,
        segmentosTrasladar: ["cfg_reg_turno_n"],
        segmentosIncorporadosDestino: ["cfg_reg_turno_t", "cfg_reg_turno_n"],
        turnoIdDestino: "cfg_reg_turno_t",
      },
    ];
    const st = estadoDestinoConPreview(capa, ops, PER, FECHA, TURNOS);
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_m"));
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_t"));
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_n"));
    assert.equal(st.horas, 24);
  });

  it("estadoDestinoConPreview suma capa y borrador por turnoIdDestino", () => {
    const capa = {
      segmentos: [{ segmento_id: "cfg_reg_turno_m", horas_efectivas: 8 }],
      horas_teoricas_totales: 8,
    };
    const ops = [
      {
        tipo: "reemplazo",
        personaId: PER,
        fechaDestinoYmd: FECHA,
        segmentosTrasladar: ["cfg_reg_turno_n"],
        turnoIdDestino: "cfg_reg_turno_t",
      },
    ];
    const st = estadoDestinoConPreview(capa, ops, PER, FECHA, TURNOS);
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_m"));
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_t"));
    assert.equal(st.horas, 16);
  });

  it("proyectarDiaConOpsPendientes quita tramo cedido en swap pendiente (origen)", () => {
    const capa = {
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      segmentos: ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"].map((id) => ({
        segmento_id: id,
        horas_efectivas: 8,
      })),
      horas_teoricas_totales: 24,
    };
    const ops = [
      {
        tipo: "cobertura_parcial",
        personaOrigenId: PER,
        personaDestinoId: "per_otro",
        fechaOrigenYmd: FECHA,
        fechaDestinoYmd: FECHA2,
        segmentosCedidosOrigen: ["cfg_reg_turno_n"],
        segmentosCedidosDestino: ["cfg_reg_turno_m"],
      },
    ];
    const st = proyectarDiaConOpsPendientes(capa, ops, PER, FECHA, TURNOS);
    assert.ok(!st.segmentoIds.includes("cfg_reg_turno_n"));
    assert.ok(st.segmentoIds.includes("cfg_reg_turno_m"));
    assert.equal(st.horas, 16);
  });

  it("B-N5 rechaza traslado noop mismo día mismos tramos", () => {
    const capa = {
      segmentos: [{ segmento_id: "cfg_reg_turno_m", horas_efectivas: 8 }],
      horas_teoricas_totales: 8,
    };
    const val = validarTrasladoPropioDestino({
      capaOrigen: capa,
      capaDestino: capa,
      fechaOrigenYmd: FECHA,
      fechaDestinoYmd: FECHA,
      segmentosTrasladar: ["cfg_reg_turno_m"],
      turnoIdDestino: "cfg_reg_turno_m",
      opsPendientes: [],
      personaId: PER,
      turnosPorId: TURNOS,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /sin efecto/i);
  });

  it("permite trasladar N del origen e incorporar M en destino con N presente", () => {
    const capa = { segmentos: [{ segmento_id: "cfg_reg_turno_n", horas_efectivas: 8 }] };
    const val = validarTrasladoPropioDestino({
      capaDestino: capa,
      segmentosTrasladar: ["cfg_reg_turno_n"],
      turnoIdDestino: "cfg_reg_turno_m",
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    assert.equal(val.ok, true);
    assert.match(val.preview?.despues || "", /M\+N|N\+M/);
  });

  it("rechaza colisión cuando turnoIdDestino ya está en destino", () => {
    const capa = { segmentos: [{ segmento_id: "cfg_reg_turno_n", horas_efectivas: 8 }] };
    const val = validarIncorporacionDestino({
      capaDestino: capa,
      turnoIdDestino: "cfg_reg_turno_n",
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /ya tiene N/i);
    assert.ok(Array.isArray(val.alternativas));
    assert.ok(val.alternativas.some((a) => a.label === "M" || a.label === "T"));
  });

  it("mensajeErrorColisionDestino lista alternativas", () => {
    const msg = mensajeErrorColisionDestino(
      "cfg_reg_turno_n",
      [{ label: "M" }, { label: "T" }],
      TURNOS,
    );
    assert.match(msg, /incorporar en ese día: M, T/);
    assert.match(msg, /franco/);
  });

  it("rechaza tope 24h", () => {
    const capa = {
      segmentos: [
        { segmento_id: "a", horas_efectivas: 8 },
        { segmento_id: "b", horas_efectivas: 8 },
        { segmento_id: "c", horas_efectivas: 8 },
      ],
      horas_teoricas_totales: 24,
    };
    const val = validarIncorporacionDestino({
      capaDestino: capa,
      turnoIdDestino: "d",
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: { d: { horas_efectivas: 1 } },
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", new RegExp(String(TOPE_HORAS_DIA)));
  });

  it("turnosIncorporablesEnDestino excluye N si destino ya tiene N", () => {
    const capa = { segmentos: [{ segmento_id: "cfg_reg_turno_n", horas_efectivas: 8 }] };
    const lista = turnosIncorporablesEnDestino({
      capaDestino: capa,
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    const labels = lista.map((x) => x.label);
    assert.ok(!labels.includes("N"));
    assert.ok(labels.includes("M"));
    assert.ok(labels.includes("T"));
  });

  it("con 2+ tramos origen exige misma cantidad en destino y lista régimen incorporable", () => {
    const capa = { segmentos: [{ segmento_id: "cfg_reg_turno_n", horas_efectivas: 8 }] };
    const opcs = resolverOpcionesDestinoTraslado({
      capaDestino: capa,
      segmentosTrasladar: ["cfg_reg_turno_m", "cfg_reg_turno_t"],
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    assert.equal(opcs.opciones.length, 2);
    assert.equal(opcs.modoMulti, true);
    assert.equal(opcs.cantidadRequerida, 2);
    assert.match(opcs.avisoIntermedio, /2 turnos en destino/i);
  });

  it("permite T+N en destino cuando origen es M+T", () => {
    const val = validarTrasladoPropioDestino({
      capaDestino: { segmentos: [] },
      segmentosTrasladar: ["cfg_reg_turno_m", "cfg_reg_turno_t"],
      turnosIdDestino: ["cfg_reg_turno_t", "cfg_reg_turno_n"],
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    assert.equal(val.ok, true);
    assert.match(val.preview?.despues || "", /T\+N|N\+T/);
  });

  it("rechaza si destino multi no alcanza la cantidad del origen", () => {
    const val = validarTrasladoPropioDestino({
      capaDestino: { segmentos: [] },
      segmentosTrasladar: ["cfg_reg_turno_m", "cfg_reg_turno_t"],
      turnosIdDestino: ["cfg_reg_turno_m"],
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /exactamente 2/i);
  });

  it("resuelve turno compuesto MTN al incorporar M+T+N", () => {
    const TURNOS_MTN = {
      ...TURNOS,
      "cfg_reg_turno_m+cfg_reg_turno_t+cfg_reg_turno_n": {
        codigo_interno: "MTN",
        horas_efectivas: 24,
      },
    };
    const comp = resolverCompuestoRegimenParaIncorporacion(
      ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
      TURNOS_MTN,
    );
    assert.equal(comp?.turno_id, "cfg_reg_turno_m+cfg_reg_turno_t+cfg_reg_turno_n");
    const val = validarIncorporacionDestinoMultiple({
      capaDestino: { segmentos: [] },
      turnosIdDestino: ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
      opsPendientes: [],
      personaId: PER,
      fechaDestinoYmd: FECHA,
      turnosPorId: TURNOS_MTN,
    });
    assert.equal(val.ok, true);
    assert.equal(val.turnoIdDestinoWire, "cfg_reg_turno_m+cfg_reg_turno_t+cfg_reg_turno_n");
    assert.equal(val.preview?.esCompuesto, true);
  });

  it("origen franco solo si se quitan todos los tramos", () => {
    assert.equal(
      origenQuedaFrancoCompleto(
        ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
        ["cfg_reg_turno_t"],
      ),
      false,
    );
    assert.equal(
      origenQuedaFrancoCompleto(
        ["cfg_reg_turno_m", "cfg_reg_turno_t"],
        ["cfg_reg_turno_m", "cfg_reg_turno_t"],
      ),
      true,
    );
    assert.equal(
      etiquetaSaldoOrigenTrasTraslado(
        ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
        ["cfg_reg_turno_t"],
        TURNOS,
      ),
      "M+N",
    );
  });

  it("buildReemplazoPropioOutboxOp separa origen y turno destino", () => {
    const op = buildReemplazoPropioOutboxOp({
      personaId: PER,
      fechaOrigenYmd: FECHA,
      fechaDestinoYmd: FECHA2,
      segmentosTrasladar: ["cfg_reg_turno_n"],
      turnoIdDestino: "cfg_reg_turno_m",
      motivo: "Traslado reunión",
      expectedVersionToken: "tok",
      grupoId: "gdt_x",
      periodo: "2026-06",
    });
    assert.equal(op.francoEnOrigen, false);
    assert.ok(esReemplazoPropioV2(op));
    assert.deepEqual(op.segmentosTrasladar, ["cfg_reg_turno_n"]);
    assert.equal(op.turnoIdDestino, "cfg_reg_turno_m");
    assert.deepEqual(op.segmentosIncorporadosDestino, ["cfg_reg_turno_m"]);
  });
});

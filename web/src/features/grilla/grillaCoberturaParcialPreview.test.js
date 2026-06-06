import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capaElegibleIntercambioGuardia,
  validarIntercambioGuardia,
  validarMismoRegimenHorario,
  validarEmparejamientoHoras,
  validarSubsetSegmentosCedidos,
  buildIntercambioGuardiaOutboxOp,
  esIntercambioGuardiaV2,
  regimenPermiteIntercambioGuardia,
  DEFAULT_TCC_CAMBIO_INTERNO,
} from "./grillaCoberturaParcialPreview.js";

const PER_A = "per_a";
const PER_B = "per_b";
const FECHA1 = "2026-06-05";
const FECHA2 = "2026-06-12";
const PERIODO = "2026-06";

const TURNOS = {
  cfg_reg_turno_m: { horas_efectivas: 8, codigo_interno: "M" },
  cfg_reg_turno_t: { horas_efectivas: 8, codigo_interno: "T" },
  cfg_reg_turno_n: { horas_efectivas: 8, codigo_interno: "N" },
};

function capaLaborable(ids) {
  return {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    segmentos: ids.map((id) => ({ segmento_id: id, horas_efectivas: 8 })),
    horas_teoricas_totales: ids.length * 8,
  };
}

const REGIMEN_MTN = "cfg_regimen_mtn";
const REGIMEN_OTRO = "cfg_regimen_otro";
const REGIMENES_PLANIFICADO = {
  [REGIMEN_MTN]: { tipo_patron: "planificado", nombre: "Guardia MTN" },
};
const REGIMEN_ADMIN_PLAN = "cfg_regimen_admin";
const REGIMENES_ADMIN = {
  [REGIMEN_ADMIN_PLAN]: { tipo_patron: "planificado", nombre: "Admin planificado" },
};

describe("grillaCoberturaParcialPreview", () => {
  it("rechaza capa franco para intercambio", () => {
    const r = capaElegibleIntercambioGuardia({ tipo_dia: "franco", segmentos: [] });
    assert.equal(r.ok, false);
  });

  it("empareja M de XX con T de YY (8 h)", () => {
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t"]),
      capaDestino: capaLaborable(["cfg_reg_turno_t"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
    });
    assert.equal(val.ok, true);
    assert.equal(val.preview?.origen?.cede, "M");
    assert.equal(val.preview?.destino?.cede, "T");
  });

  it("rechaza carga horaria distinta", () => {
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m", "cfg_reg_turno_t"],
      segmentosCedidosDestino: ["cfg_reg_turno_n"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t"]),
      capaDestino: capaLaborable(["cfg_reg_turno_n"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /equivalente/i);
  });

  it("rechaza mismo agente", () => {
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_A,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m"]),
      capaDestino: capaLaborable(["cfg_reg_turno_t"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
    });
    assert.equal(val.ok, false);
  });

  it("validarSubsetSegmentosCedidos exige pertenencia al día", () => {
    const r = validarSubsetSegmentosCedidos(
      ["cfg_reg_turno_n"],
      ["cfg_reg_turno_m", "cfg_reg_turno_t"],
    );
    assert.equal(r.ok, false);
  });

  it("validarEmparejamientoHoras exige horas positivas iguales", () => {
    assert.equal(validarEmparejamientoHoras(8, 8).ok, true);
    assert.equal(validarEmparejamientoHoras(8, 16).ok, false);
  });

  it("rechaza intercambio con régimen horario distinto", () => {
    const reg = validarMismoRegimenHorario(REGIMEN_MTN, REGIMEN_OTRO, {
      [REGIMEN_MTN]: { nombre: "Guardia MTN" },
      [REGIMEN_OTRO]: { nombre: "Administrativo" },
    });
    assert.equal(reg.ok, false);
    assert.match(reg.error || "", /mismo régimen/i);

    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m"]),
      capaDestino: capaLaborable(["cfg_reg_turno_t"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_OTRO,
      regimenesIdx: {
        ...REGIMENES_PLANIFICADO,
        [REGIMEN_OTRO]: { tipo_patron: "rotativo", nombre: "Administrativo" },
      },
    });
    assert.equal(val.ok, false);
  });

  it("rechaza intercambio con régimen fijo", () => {
    const REG_FIJO = "cfg_regimen_fijo";
    assert.equal(
      regimenPermiteIntercambioGuardia(REG_FIJO, {
        [REG_FIJO]: { tipo_patron: "fijo", nombre: "Administrativo 08-14" },
      }).ok,
      false,
    );

    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m"]),
      capaDestino: capaLaborable(["cfg_reg_turno_t"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REG_FIJO,
      regimenHorarioIdDestino: REG_FIJO,
      regimenesIdx: {
        [REG_FIJO]: { tipo_patron: "fijo", nombre: "Administrativo 08-14" },
      },
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /fijo/i);
  });

  it("empareja tramo administrativo 6 h desde ISO sin entrada en turnosPorId", () => {
    const SEG_ID = "__horario__";
    const capaAdmin6h = {
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      segmentos: [
        {
          segmento_id: SEG_ID,
          ingreso_iso: "2026-06-25T08:00:00.000-03:00",
          egreso_iso: "2026-06-25T14:00:00.000-03:00",
        },
      ],
      horas_teoricas_totales: 6,
    };
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: "2026-06-25",
      fechaDestinoYmd: "2026-06-26",
      periodo: "2026-06",
      segmentosCedidosOrigen: [SEG_ID],
      segmentosCedidosDestino: [SEG_ID],
      capaOrigen: capaAdmin6h,
      capaDestino: capaAdmin6h,
      turnosPorIdOrigen: {},
      turnosPorIdDestino: {},
      regimenHorarioIdOrigen: REGIMEN_ADMIN_PLAN,
      regimenHorarioIdDestino: REGIMEN_ADMIN_PLAN,
      regimenesIdx: REGIMENES_ADMIN,
    });
    assert.equal(val.ok, true);
    assert.equal(val.preview?.origen?.horas, 6);
  });

  it("A-N1 rechaza ceder tramo ya cedido en borrador pendiente", () => {
    const capa = capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"]);
    const ops = [
      {
        tipo: "cobertura_parcial",
        personaOrigenId: PER_A,
        personaDestinoId: PER_B,
        fechaOrigenYmd: FECHA1,
        fechaDestinoYmd: FECHA2,
        segmentosCedidosOrigen: ["cfg_reg_turno_n"],
        segmentosCedidosDestino: ["cfg_reg_turno_m"],
      },
    ];
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_n"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      capaOrigen: capa,
      capaDestino: capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
      opsPendientes: ops,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /Agente 1/i);
  });

  it("A-N1 permite swap N↔M con preview acumulado (LOKITO/MOSTO)", () => {
    const capaMtn = capaLaborable(["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"]);
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA1,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_n"],
      segmentosCedidosDestino: ["cfg_reg_turno_m"],
      capaOrigen: capaMtn,
      capaDestino: capaLaborable(["cfg_reg_turno_m"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
    });
    assert.equal(val.ok, true);
    assert.equal(val.preview?.origen?.cede, "N");
    assert.equal(val.preview?.destino?.cede, "M");
  });

  it("A-N5 rechaza swap sin efecto (mismos tramos mismo día)", () => {
    const val = validarIntercambioGuardia({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA1,
      periodo: PERIODO,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_m"],
      capaOrigen: capaLaborable(["cfg_reg_turno_m"]),
      capaDestino: capaLaborable(["cfg_reg_turno_m"]),
      turnosPorIdOrigen: TURNOS,
      turnosPorIdDestino: TURNOS,
      regimenHorarioIdOrigen: REGIMEN_MTN,
      regimenHorarioIdDestino: REGIMEN_MTN,
      regimenesIdx: REGIMENES_PLANIFICADO,
    });
    assert.equal(val.ok, false);
    assert.match(val.error || "", /sin efecto/i);
  });

  it("buildIntercambioGuardiaOutboxOp arma payload v2 bilateral", () => {
    const op = buildIntercambioGuardiaOutboxOp({
      personaOrigenId: PER_A,
      personaDestinoId: PER_B,
      fechaOrigenYmd: FECHA1,
      fechaDestinoYmd: FECHA2,
      segmentosCedidosOrigen: ["cfg_reg_turno_m"],
      segmentosCedidosDestino: ["cfg_reg_turno_t"],
      motivo: "Intercambio guardia",
      expectedVersionTokenOrigen: "tok_a",
      expectedVersionTokenDestino: "tok_b",
      grupoId: "gdt_x",
      periodo: PERIODO,
    });
    assert.ok(esIntercambioGuardiaV2(op));
    assert.equal(op.tipoCompensacionId, DEFAULT_TCC_CAMBIO_INTERNO);
    assert.deepEqual(op.segmentosCedidosOrigen, ["cfg_reg_turno_m"]);
    assert.deepEqual(op.segmentosCedidosDestino, ["cfg_reg_turno_t"]);
  });
});

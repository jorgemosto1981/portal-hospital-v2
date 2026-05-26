"use strict";

/**
 * Paso 2 entorno — validarEntornoOperativoSolicitud
 * node --test functions/test/validarEntornoOperativo.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validarEntornoOperativoSolicitud } = require("../modules/ticketera/validarEntornoOperativoCore");
const { evaluarGrillaTurnoEntorno } = require("../modules/ticketera/grillaTurnoEntornoGate");

const PER = "per_TEST01";
const ART = "art_TEST01";
const VER = "ver_TEST01";
const GDT = "gdt_TEST01";
const HLC = "hlc_TEST01";
const FECHA = "2026-05-21";

function snap(exists, data = {}, id = "doc") {
  return { exists, id, data: () => data };
}

/**
 * @param {{
 *   hlcRows?: Array<Record<string, unknown>>,
 *   hlgRows?: Array<Record<string, unknown>>,
 *   dependeRda?: boolean,
 *   plans?: Record<string, Record<string, unknown>>,
 *   asi?: Record<string, Record<string, unknown>>,
 * }} cfg
 */
function mockDb(cfg = {}) {
  const hlcRows = cfg.hlcRows ?? [
    {
      id: HLC,
      persona_id: PER,
      fecha_inicio: "2020-01-01",
      fecha_fin: null,
      escalafon_id: "cfg_esc_01",
      rol_id: "cfg_rol_agente",
      grupo_de_trabajo_id: GDT,
    },
  ];
  const hlgRows = cfg.hlgRows ?? [
    {
      id: "hlg_TEST01",
      persona_id: PER,
      grupo_de_trabajo_id: GDT,
      fecha_inicio: "2020-01-01",
      activo: true,
    },
  ];

  const versionData = {
    estado_version_id: "cfg_est_ver_publicada",
    bloque_identidad_naturaleza: { es_lao_anual: false },
    bloque_elegibilidad_filtros: {},
    bloque_workflow_sla_cobertura: { circuito_ingreso_ids: ["cfg_rol_agente"] },
    bloque_topes_plazos_computo: {
      tope_dias_por_evento: 1,
      depende_rda: cfg.dependeRda === true,
      reinicio_ciclo_id: "cfg_rcc_anual",
      origen_saldo_id: "cfg_os_interno",
    },
  };

  return {
    collection(name) {
      if (name === "personas") {
        return {
          doc: () => ({
            get: async () => snap(true, { antiguedad_reconocida_dias: 0 }, PER),
          }),
        };
      }
      if (name === "historial_laboral_cargos") {
        return {
          where: () => ({
            get: async () => ({
              docs: hlcRows.map((r) => ({
                id: String(r.id),
                data: () => ({ ...r }),
              })),
            }),
          }),
        };
      }
      if (name === "historial_laboral_grupos") {
        return {
          where: () => ({
            get: async () => ({
              docs: hlgRows.map((r) => ({
                id: String(r.id),
                data: () => ({ ...r }),
              })),
            }),
          }),
        };
      }
      if (name === "grupos_de_trabajo") {
        return {
          doc: (id) => ({
            get: async () => snap(true, { nombre: "Grupo test" }, id),
          }),
        };
      }
      if (name === "cfg_articulos") {
        return {
          doc: () => ({
            collection: () => ({
              doc: () => ({
                get: async () => snap(true, versionData, VER),
              }),
            }),
          }),
        };
      }
      if (name === "planificacion_mensual_rotativa") {
        return {
          doc: (id) => ({
            get: async () => {
              const d = cfg.plans?.[id];
              return d ? snap(true, d, id) : snap(false);
            },
          }),
        };
      }
      if (name === "asistencia_diaria") {
        return {
          doc: (id) => ({
            get: async () => {
              const d = cfg.asi?.[id];
              return d ? snap(true, d, id) : snap(false);
            },
          }),
        };
      }
      const emptyChainable = () => ({
        where: emptyChainable,
        get: async () => ({ docs: [], empty: true }),
      });
      return {
        doc: () => ({ get: async () => snap(false) }),
        where: emptyChainable,
      };
    },
  };
}

const authToken = { cargo_activo: true, roles_hlc_vigentes: ["cfg_rol_agente"] };

describe("validarEntornoOperativoSolicitud", () => {
  it("T2-ent-01: agente OK sin depende_rda", async () => {
    const r = await validarEntornoOperativoSolicitud({
      db: mockDb({ dependeRda: false }),
      personaId: PER,
      articuloId: ART,
      versionId: VER,
      fechaDesde: FECHA,
      authToken,
    });
    assert.equal(r.ok, true);
    assert.equal(r.puede_previsualizar, true);
    assert.equal(r.grupo_trabajo_id_ancla, GDT);
    assert.equal(r.checks.hlc_vigente, true);
    assert.equal(r.checks.grupo_ancla_resuelto, true);
    assert.equal(r.checks.turno, null);
  });

  it("T2-ent-02: sin grupo activo en fecha_desde", async () => {
    const r = await validarEntornoOperativoSolicitud({
      db: mockDb({ hlgRows: [] }),
      personaId: PER,
      articuloId: ART,
      versionId: VER,
      fechaDesde: FECHA,
      authToken,
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes("SIN_GRUPO_VIGENTE"));
    assert.equal(r.checks.grupo_trabajo_vigente, false);
  });

  it("T2-ent-03: depende_rda sin turno planificado (sin capa_teorica)", async () => {
    const r = await validarEntornoOperativoSolicitud({
      db: mockDb({ dependeRda: true, asi: {} }),
      personaId: PER,
      articuloId: ART,
      versionId: VER,
      fechaDesde: FECHA,
      grupoTrabajoIdAncla: GDT,
      authToken,
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes("TURNO_NO_PLANIFICADO"));
    assert.equal(r.checks.turno, false);
    assert.equal(r.checks.grilla_rda, false);
  });

  it("T2-ent-04: depende_rda plan existe pero no autorizado", async () => {
    const planId = `${GDT}_2026_05`;
    const r = await validarEntornoOperativoSolicitud({
      db: mockDb({
        dependeRda: true,
        plans: { [planId]: { estado_plan: "BORRADOR" } },
      }),
      personaId: PER,
      articuloId: ART,
      versionId: VER,
      fechaDesde: FECHA,
      grupoTrabajoIdAncla: GDT,
      authToken,
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes("GRILLA_NO_AUTORIZADA"));
    assert.equal(r.checks.turno, false);
  });

  it("T2-ent-05: HLC no vigente en fecha_desde", async () => {
    const r = await validarEntornoOperativoSolicitud({
      db: mockDb({
        hlcRows: [
          {
            id: HLC,
            persona_id: PER,
            fecha_inicio: "2020-01-01",
            fecha_fin: "2025-12-31",
            rol_id: "cfg_rol_agente",
          },
        ],
      }),
      personaId: PER,
      articuloId: ART,
      versionId: VER,
      fechaDesde: FECHA,
      authToken,
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes("ELEG_SIN_HLC"));
    assert.equal(r.checks.hlc_vigente, false);
  });
});

describe("evaluarGrillaTurnoEntorno", () => {
  it("depende_rda false no evalúa turno", async () => {
    const r = await evaluarGrillaTurnoEntorno(mockDb(), {
      depende_rda: false,
      persona_id: PER,
      fecha_desde: FECHA,
    });
    assert.equal(r.ok, true);
    assert.equal(r.checks.turno, null);
  });
});

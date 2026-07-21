"use strict";

/**
 * node --test functions/test/solicitudArt770DerivacionCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  debeMaterializar770AlRechazar,
  materializarSol770,
  materializarSol770DesdeRechazo,
  materializarSol770AltaRrhh,
  ORIGEN_ACTO_ALTA_RRHH,
} = require("../modules/shared/solicitudArt770DerivacionCore");
const { ESTADO_SOLICITUD_APROBADA } = require("../modules/shared/solicitudesArticuloEstados");

describe("debeMaterializar770AlRechazar", () => {
  it("solo en rechazo de autorización (no observado)", () => {
    assert.equal(
      debeMaterializar770AlRechazar({ modo_resolucion_jefe: "autorizacion" }, { decision_ui: "rechazado" }),
      true,
    );
    assert.equal(
      debeMaterializar770AlRechazar({ modo_resolucion_jefe: "autorizacion" }, { decision_ui: "observado" }),
      false,
    );
    assert.equal(
      debeMaterializar770AlRechazar({ modo_resolucion_jefe: "toma_conocimiento" }, {}),
      false,
    );
  });
});

describe("materializarSol770 / alta RRHH", () => {
  function makeDb(opts = {}) {
    /** @type {Record<string, Record<string, unknown>>} */
    const sols = {};
    const personas = opts.personas || {};
    const art = opts.art || {
      artId: "art_770",
      verId: "ver_770",
      versionData: {
        bloque_workflow_sla_cobertura: {
          circuito_ingreso_ids: ["CFG_RRHH"],
          umbral_inasistencias_injustificadas_dias: 10,
          ventana_acumulado_meses: 12,
          notificar_rrhh_al_umbral: false,
        },
      },
    };

    return {
      art,
      sols,
      collection(name) {
        if (name === "cfg_articulos") {
          return {
            where(field, _op, value) {
              assert.equal(field, "codigo");
              return {
                limit() {
                  return {
                    async get() {
                      if (value !== "77-0" || opts.sinArt) return { empty: true, docs: [] };
                      return {
                        empty: false,
                        docs: [{ id: art.artId, data: () => ({ codigo: "77-0", activo: true }) }],
                      };
                    },
                  };
                },
              };
            },
            doc(artId) {
              return {
                collection(sub) {
                  assert.equal(sub, "versiones");
                  return {
                    where() {
                      return {
                        limit() {
                          return {
                            async get() {
                              return {
                                empty: false,
                                docs: [{ id: art.verId, data: () => ({ ...art.versionData }) }],
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (name === "solicitudes_articulo") {
          return {
            doc(id) {
              return {
                async set(data) {
                  sols[id] = { ...(sols[id] || {}), ...data };
                },
                collection() {
                  return {
                    doc() {
                      return {
                        async set() {},
                      };
                    },
                    async add() {
                      return { id: "evt_test" };
                    },
                  };
                },
              };
            },
            where() {
              return {
                where() {
                  return {
                    async get() {
                      return { docs: [] };
                    },
                  };
                },
              };
            },
          };
        }
        if (name === "personas") {
          return {
            doc(id) {
              return {
                async get() {
                  const p = personas[id];
                  return { exists: Boolean(p), data: () => (p ? { ...p } : {}) };
                },
                async set() {},
              };
            },
          };
        }
        // Cola MDC / otros: no-op
        return {
          doc() {
            return {
              async set() {},
              collection() {
                return {
                  doc() {
                    return { async set() {} };
                  },
                  async add() {
                    return { id: "x" };
                  },
                };
              },
            };
          },
          async add() {
            return { id: "x" };
          },
        };
      },
    };
  }

  it("alta RRHH escribe origen_acto alta_rrhh y estado aprobada", async () => {
    const db = makeDb();
    const r = await materializarSol770AltaRrhh(db, {
      titularPersonaId: "per_01TITULAR000000000000000",
      fechaDesde: "2026-07-20",
      fechaHasta: "2026-07-20",
      diasSolicitados: 1,
      grupoTrabajoIdAncla: "gdt_01TEST",
      actorPersonaId: "per_01RRHH000000000000000000",
      observacionAlta: "Falta injustificada cargada por RRHH",
    });
    assert.equal(r.ok, true);
    const id = r.solicitud_77_0_id;
    assert.match(id, /^sol_/);
    const doc = db.sols[id];
    assert.equal(doc.origen_acto, ORIGEN_ACTO_ALTA_RRHH);
    assert.equal(doc.origen_rechazo_sol_id, null);
    assert.equal(doc.estado_solicitud_id, ESTADO_SOLICITUD_APROBADA);
    assert.equal(doc.titular_persona_id, "per_01TITULAR000000000000000");
    assert.equal(doc.observacion_alta, "Falta injustificada cargada por RRHH");
    assert.equal(doc.codigo_grilla, "77-0");
    assert.equal(doc.modo_resolucion_jefe, "ninguno");
  });

  it("rechaza alta si circuito no incluye CFG_RRHH", async () => {
    const db = makeDb({
      art: {
        artId: "art_770",
        verId: "ver_770",
        versionData: {
          bloque_workflow_sla_cobertura: { circuito_ingreso_ids: ["CFG_USUARIO"] },
        },
      },
    });
    const r = await materializarSol770AltaRrhh(db, {
      titularPersonaId: "per_01TITULAR000000000000000",
      fechaDesde: "2026-07-20",
      actorPersonaId: "per_01RRHH000000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "CIRCUITO_ROL");
  });

  it("wrapper rechazo preserva origen_rechazo_sol_id", async () => {
    const db = makeDb();
    const r = await materializarSol770DesdeRechazo(db, {
      solOrigen: {
        titular_persona_id: "per_01TITULAR000000000000000",
        fecha_desde: "2026-07-18",
        fecha_hasta: "2026-07-18",
        dias_solicitados: 1,
        grupo_trabajo_id_ancla: "gdt_01TEST",
      },
      solOrigenId: "sol_01ORIGEN0000000000000000",
      revisorPersonaId: "per_01JEFE000000000000000000",
      origenActo: "rechazo_autorizacion_jefe",
    });
    assert.equal(r.ok, true);
    const doc = db.sols[r.solicitud_77_0_id];
    assert.equal(doc.origen_acto, "rechazo_autorizacion_jefe");
    assert.equal(doc.origen_rechazo_sol_id, "sol_01ORIGEN0000000000000000");
  });

  it("materializarSol770 valida titular", async () => {
    const db = makeDb();
    const r = await materializarSol770(db, {
      titularPersonaId: "no-per",
      fechaDesde: "2026-07-20",
      actorPersonaId: "per_01RRHH000000000000000000",
      origenActo: ORIGEN_ACTO_ALTA_RRHH,
      art: db.art,
    });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "TITULAR_INVALIDO");
  });
});

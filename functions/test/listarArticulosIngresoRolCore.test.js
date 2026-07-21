"use strict";

/**
 * node --test functions/test/listarArticulosIngresoRolCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizarRolCircuito,
  tokenIncluyeRolCircuito,
  puedeConsultarTitularAjeno,
  versionIncluyeRolEnCircuito,
  esArticuloOperativo,
  evaluarElegibilidadTitular,
  listarArticulosIngresoPorRol,
} = require("../modules/shared/listarArticulosIngresoRolCore");

describe("normalizarRolCircuito", () => {
  it("acepta los cuatro roles canónicos", () => {
    assert.equal(normalizarRolCircuito("CFG_RRHH"), "CFG_RRHH");
    assert.equal(normalizarRolCircuito("cfg_medico"), "CFG_MEDICO");
    assert.equal(normalizarRolCircuito("CFG_JEFE"), "");
  });
});

describe("tokenIncluyeRolCircuito", () => {
  it("exige el rol pedido en roles_hlc_vigentes", () => {
    const token = { roles_hlc_vigentes: ["CFG_RRHH", "CFG_USUARIO"] };
    assert.equal(tokenIncluyeRolCircuito(token, "CFG_RRHH"), true);
    assert.equal(tokenIncluyeRolCircuito(token, "CFG_MEDICO"), false);
  });
});

describe("puedeConsultarTitularAjeno", () => {
  const actor = "per_01ACTOR000000000000000000";
  const otro = "per_01OTRO0000000000000000000";

  it("CFG_USUARIO solo puede consultar su propia persona", () => {
    assert.equal(puedeConsultarTitularAjeno(actor, actor, "CFG_USUARIO"), true);
    assert.equal(puedeConsultarTitularAjeno(actor, otro, "CFG_USUARIO"), false);
  });

  it("CFG_RRHH / MEDICO / VISUALIZADOR pueden consultar otro titular", () => {
    assert.equal(puedeConsultarTitularAjeno(actor, otro, "CFG_RRHH"), true);
    assert.equal(puedeConsultarTitularAjeno(actor, otro, "CFG_MEDICO"), true);
    assert.equal(puedeConsultarTitularAjeno(actor, otro, "CFG_VISUALIZADOR"), true);
  });
});

describe("versionIncluyeRolEnCircuito", () => {
  it("filtra por circuito_ingreso_ids sin bypass", () => {
    const version = {
      bloque_workflow_sla_cobertura: {
        circuito_ingreso_ids: ["CFG_RRHH"],
      },
    };
    assert.equal(versionIncluyeRolEnCircuito(version, "CFG_RRHH"), true);
    assert.equal(versionIncluyeRolEnCircuito(version, "CFG_USUARIO"), false);
    assert.equal(versionIncluyeRolEnCircuito(version, "CFG_MEDICO"), false);
  });

  it("circuito vacío no habilita a nadie", () => {
    assert.equal(
      versionIncluyeRolEnCircuito({ bloque_workflow_sla_cobertura: { circuito_ingreso_ids: [] } }, "CFG_RRHH"),
      false,
    );
  });
});

describe("esArticuloOperativo", () => {
  it("rechaza activo false", () => {
    assert.equal(esArticuloOperativo({ activo: false }), false);
    assert.equal(esArticuloOperativo({ activo: true }), true);
  });
});

describe("evaluarElegibilidadTitular", () => {
  it("no exige que el titular tenga el rol del circuito (solo filtros laborales)", () => {
    const versionData = {
      bloque_workflow_sla_cobertura: { circuito_ingreso_ids: ["CFG_RRHH"] },
      bloque_elegibilidad_filtros: { escalafon_ids: [] },
    };
    const hlcVigentes = [
      {
        id: "hlc_1",
        rol_id: "CFG_USUARIO",
        escalafon_id: "CFG_ESC_02_ADMINISTRACION",
        fecha_desde: "2020-01-01",
        fecha_hasta: null,
        activo: true,
      },
    ];
    const r = evaluarElegibilidadTitular({
      versionData,
      hlcVigentes,
      personaId: "per_01TITULAR000000000000000",
      fechaDesde: "2026-07-21",
    });
    assert.equal(r.ok, true);
  });
});

describe("listarArticulosIngresoPorRol (orquestación)", () => {
  function makeDb({ persona, articulos }) {
    return {
      collection(name) {
        if (name === "personas") {
          return {
            doc(id) {
              return {
                async get() {
                  const p = persona && persona.id === id ? persona : null;
                  return { exists: Boolean(p), data: () => (p ? { ...p } : {}) };
                },
              };
            },
          };
        }
        if (name === "historial_laboral_cargos") {
          return {
            where() {
              return {
                async get() {
                  return { docs: [] };
                },
              };
            },
          };
        }
        if (name === "cfg_articulos") {
          return {
            doc(id) {
              const art = (articulos || []).find((a) => a.id === id);
              return {
                async get() {
                  return {
                    exists: Boolean(art),
                    id,
                    data: () => (art ? { ...art.core } : {}),
                  };
                },
              };
            },
          };
        }
        throw new Error(`colección inesperada ${name}`);
      },
      collectionGroup(name) {
        if (name !== "versiones") throw new Error(name);
        return {
          where() {
            return {
              async get() {
                const docs = [];
                for (const art of articulos || []) {
                  docs.push({
                    id: art.versionId,
                    ref: {
                      parent: { parent: { id: art.id } },
                    },
                    data: () => ({ ...art.versionData }),
                  });
                }
                return { docs };
              },
            };
          },
        };
      },
      async getAll(...refs) {
        // No se usa si discover falla; stub mínimo.
        return refs.map((ref) => ({
          exists: false,
          id: ref?.id,
          data: () => ({}),
        }));
      },
    };
  }

  it("CFG_USUARIO no puede listar para otro titular", async () => {
    const db = makeDb({ persona: { id: "per_01OTRO0000000000000000000" }, articulos: [] });
    const r = await listarArticulosIngresoPorRol({
      db,
      rolActor: "CFG_USUARIO",
      actorPersonaId: "per_01ACTOR000000000000000000",
      titularPersonaId: "per_01OTRO0000000000000000000",
      fechaDesde: "2026-07-21",
      authToken: { roles_hlc_vigentes: ["CFG_USUARIO"] },
    });
    assert.equal(r.error, "permission-denied");
  });

  it("incluye 77-0 para CFG_RRHH aunque no esté en allowlist Etapa 1", async () => {
    const art770 = {
      id: "art_01KY770TEST00000000000000",
      versionId: "ver_01KY770TEST00000000000000",
      core: {
        activo: true,
        codigo: "77-0",
        nombre: "INASISTENCIA INJUSTIFICADA",
      },
      versionData: {
        estado_version_id: "cfg_est_ver_publicada",
        vigente_desde: "2026-01-01",
        bloque_workflow_sla_cobertura: { circuito_ingreso_ids: ["CFG_RRHH"] },
        bloque_elegibilidad_filtros: {},
        bloque_identidad_naturaleza: { es_inasistencia: true },
        bloque_topes_plazos_computo: {
          reinicio_ciclo_id: "cfg_rcc_anual",
          origen_saldo_id: "cfg_os_interno",
        },
      },
    };

    // Stub discover path: override getAll + collectionGroup already built.
    const db = makeDb({
      persona: {
        id: "per_01TITULAR000000000000000",
        antiguedad_reconocida_dias: 0,
      },
      articulos: [art770],
    });
    // getAllDocsChunked uses db.getAll — implement with art refs
    db.getAll = async (..._refs) => [
      {
        exists: true,
        id: art770.id,
        data: () => ({ ...art770.core }),
      },
    ];
    // loadHlcArray needs hlc docs — empty → elegible_titular false but artículo listado
    const r = await listarArticulosIngresoPorRol({
      db,
      rolActor: "CFG_RRHH",
      actorPersonaId: "per_01ACTOR000000000000000000",
      titularPersonaId: "per_01TITULAR000000000000000",
      fechaDesde: "2026-07-21",
      authToken: { roles_hlc_vigentes: ["CFG_RRHH"] },
    });

    assert.equal(r.error, undefined);
    assert.equal(r.meta?.sin_allowlist_etapa1, true);
    assert.equal(r.articulos.length, 1);
    assert.equal(r.articulos[0].codigo_grilla, "77-0");
    assert.equal(r.articulos[0].alta_disponible, false);
    assert.deepEqual(r.articulos[0].circuito_ingreso_ids, ["CFG_RRHH"]);
  });

  it("no lista 77-0 para CFG_MEDICO si el circuito solo tiene CFG_RRHH", async () => {
    const art770 = {
      id: "art_01KY770TEST00000000000000",
      versionId: "ver_01KY770TEST00000000000000",
      core: { activo: true, codigo: "77-0", nombre: "INASISTENCIA INJUSTIFICADA" },
      versionData: {
        estado_version_id: "cfg_est_ver_publicada",
        vigente_desde: "2026-01-01",
        bloque_workflow_sla_cobertura: { circuito_ingreso_ids: ["CFG_RRHH"] },
        bloque_elegibilidad_filtros: {},
        bloque_identidad_naturaleza: {},
        bloque_topes_plazos_computo: {
          reinicio_ciclo_id: "cfg_rcc_anual",
          origen_saldo_id: "cfg_os_interno",
        },
      },
    };
    const db = makeDb({
      persona: { id: "per_01TITULAR000000000000000" },
      articulos: [art770],
    });
    db.getAll = async () => [{ exists: true, id: art770.id, data: () => ({ ...art770.core }) }];

    const r = await listarArticulosIngresoPorRol({
      db,
      rolActor: "CFG_MEDICO",
      actorPersonaId: "per_01ACTOR000000000000000000",
      titularPersonaId: "per_01TITULAR000000000000000",
      fechaDesde: "2026-07-21",
      authToken: { roles_hlc_vigentes: ["CFG_MEDICO"] },
    });
    assert.equal(r.error, undefined);
    assert.equal(r.articulos.length, 0);
  });
});

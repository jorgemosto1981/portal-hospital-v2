"use strict";

/**
 * node --test functions/test/listarVistaGrillaMesPorGrupo.snapshot.test.js
 */
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildVisDocumentId } = require("../modules/shared/mdcRdaDocumentIds");

const GDT = "gdt_01LISTARSNAPSHOTTEST";
const PER = "per_01LISTARSNAPSHOTTEST";
const ANIO = 2026;
const MES = 6;

const WORKER_PATH = path.join(__dirname, "../modules/asistencia/rdaTurnoTeoricoWorker.js");
const CORE_PATH = path.join(__dirname, "../modules/shared/grillaMesAgenteCore.js");

let materializarGrupoMesCalls = 0;
let originalMaterializarGrupoMes;

function celdaLaborable() {
  return {
    tipo_dia: "laborable",
    es_franco: false,
    rda_ingreso: "08:00",
    rda_egreso: "14:00",
  };
}

function mesDiasLaborables(n = 30) {
  const dias = {};
  for (let d = 1; d <= n; d += 1) {
    dias[String(d).padStart(2, "0")] = celdaLaborable();
  }
  return dias;
}

function docSnap(id, data) {
  const exists = data != null;
  return {
    id,
    exists,
    data: () => (exists ? data : undefined),
  };
}

function hlgFirestoreDoc(id, data) {
  return {
    id,
    data: () => ({ ...data }),
  };
}

/**
 * Firestore mínimo para `listarVistaGrillaMesPorGrupo`.
 * @param {{ hlgRows: object[], vistas: Record<string, object>, personas?: Record<string, object> }} opts
 */
function createMockDb({ hlgRows, vistas, personas = {} }) {
  const hlgDocs = hlgRows.map((row, i) => hlgFirestoreDoc(row.hlg_id || `hlg_${i}`, row));

  const stores = {
    personas,
    vistas_grilla_mes_agente: vistas,
    cfg_regimen_horario: {},
    grilla_sync_grupo_mes: {},
    historial_laboral_datos: {},
  };

  function collection(name) {
    const queryChain = (filters) => ({
      where(field, op, val) {
        return queryChain([...filters, { field, op, val }]);
      },
      limit() {
        return queryChain(filters);
      },
      async get() {
        if (name === "historial_laboral_grupos") {
          const gdtFilter = filters.find((f) => f.field === "grupo_de_trabajo_id" && f.op === "==");
          const docs = gdtFilter
            ? hlgDocs.filter((d) => d.data().grupo_de_trabajo_id === gdtFilter.val)
            : hlgDocs;
          return { docs };
        }
        if (name === "planes_turno_servicio") {
          return { empty: true, docs: [] };
        }
        return { empty: true, docs: [] };
      },
    });

    return {
      where(field, op, val) {
        return queryChain([{ field, op, val }]);
      },
      doc(id) {
        const col = name;
        return {
          id,
          _col: col,
          async get() {
            if (col === "historial_laboral_grupos") {
              const found = hlgDocs.find((d) => d.id === id);
              return found ? docSnap(id, found.data()) : docSnap(id, null);
            }
            const data = stores[col]?.[id];
            return docSnap(id, data !== undefined ? data : null);
          },
          async set(payload) {
            stores[col][id] = { ...(stores[col][id] || {}), ...payload };
          },
        };
      },
    };
  }

  return {
    collection,
    async getAll(...refs) {
      return refs.map((ref) => {
        const col = ref._col;
        const id = ref.id;
        if (col === "vistas_grilla_mes_agente") {
          const data = vistas[id];
          return docSnap(id, data !== undefined ? data : null);
        }
        if (col === "cfg_regimen_horario") {
          return docSnap(id, stores.cfg_regimen_horario[id] ?? null);
        }
        if (col === "historial_laboral_datos") {
          return docSnap(id, stores.historial_laboral_datos[id] ?? null);
        }
        return docSnap(id, null);
      });
    },
  };
}

function fixtureDb() {
  const visId = buildVisDocumentId(PER, "2026-06-01", GDT);
  const db = createMockDb({
    hlgRows: [
      {
        hlg_id: "hlg_listar_snap",
        persona_id: PER,
        grupo_de_trabajo_id: GDT,
        activo: true,
        fecha_inicio: "2020-01-01",
        fecha_fin: null,
        regimen_horario_id: null,
        dato_laboral_id: "",
      },
    ],
    vistas: {
      [visId]: {
        persona_id: PER,
        grupo_de_trabajo_id: GDT,
        dias: mesDiasLaborables(30),
        metadata: { ultima_sync_teorica: { toDate: () => new Date("2026-06-01T12:00:00Z") } },
      },
    },
    personas: {
      [PER]: { apellido: "Agente", nombre: "Snapshot" },
    },
  });
  return { db, visId };
}

function loadListar() {
  delete require.cache[CORE_PATH];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(CORE_PATH).listarVistaGrillaMesPorGrupo;
}

describe("listarVistaGrillaMesPorGrupo — lectura snapshot", () => {
  beforeEach(() => {
    materializarGrupoMesCalls = 0;
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const worker = require(WORKER_PATH);
    originalMaterializarGrupoMes = worker.materializarGrupoMes;
    worker.materializarGrupoMes = async () => {
      materializarGrupoMesCalls += 1;
      return { ok: true, procesados: 7, fallos: [] };
    };
  });

  afterEach(() => {
    if (originalMaterializarGrupoMes) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(WORKER_PATH).materializarGrupoMes = originalMaterializarGrupoMes;
    }
    delete require.cache[CORE_PATH];
  });

  it("por defecto no invoca materializarGrupoMes y marca materializacion_grupo.omitida", async () => {
    const listar = loadListar();
    const { db } = fixtureDb();

    const result = await listar(db, {
      grupoTrabajoId: GDT,
      anio: ANIO,
      mes: MES,
    });

    assert.equal(result.ok, true);
    assert.equal(materializarGrupoMesCalls, 0);
    assert.equal(result.materializacion_grupo.omitida, true);
    assert.equal(result.materializacion_grupo.motivo, "lectura_snapshot");
    assert.equal(result.materializacion_grupo.procesados, 0);
    assert.equal(result.filas.length, 1);
    assert.equal(result.filas[0].persona_id, PER);
    assert.equal(result.filas[0].materializado_lazy, false);
    assert.equal(result.sync_estado.reconciliacion, "idle");
  });

  it("con forzarMaterializacionGrupo invoca materializarGrupoMes y no omite remat", async () => {
    const listar = loadListar();
    const { db } = fixtureDb();

    const result = await listar(db, {
      grupoTrabajoId: GDT,
      anio: ANIO,
      mes: MES,
      forzarMaterializacionGrupo: true,
    });

    assert.equal(result.ok, true);
    assert.equal(materializarGrupoMesCalls, 1);
    assert.equal(result.materializacion_grupo.omitida, undefined);
    assert.equal(result.materializacion_grupo.ok, true);
    assert.equal(result.materializacion_grupo.procesados, 7);
  });
});

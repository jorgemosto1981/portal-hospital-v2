"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { mutarEstadoSolicitudMedicaMdc } = require("../modules/shared/mutarEstadoSolicitudMedicaMdc");

function isFirestoreDeleteSentinel(v) {
  if (!v || typeof v !== "object") return false;
  if (typeof v._methodName === "string" && v._methodName.toLowerCase().includes("delete")) return true;
  return v.constructor?.name === "DeleteTransform";
}

function makeDbConAsistencia({ solDoc, asiAportesIniciales = {} }) {
  const solStore = { sol_test: { ...solDoc } };
  const asiStore = { ...asiAportesIniciales };
  const visStore = {};

  function docRef(store, id) {
    return {
      id,
      async get() {
        const data = store[id];
        if (!data) return { exists: false };
        return { exists: true, data: () => data };
      },
      async set(patch, opts) {
        store[id] = opts?.merge ? { ...(store[id] || {}), ...patch } : { ...patch };
      },
      async delete() {
        delete store[id];
      },
    };
  }

  function asiDocRef(id) {
    return {
      id,
      async get() {
        const data = asiStore[id];
        if (!data) return { exists: false };
        return { exists: true, data: () => data };
      },
      async set(patch, opts) {
        const prev = asiStore[id] || {};
        const next = opts?.merge ? { ...prev } : {};
        for (const [k, v] of Object.entries(patch)) {
          if (k.startsWith("aportes_normativos.")) {
            const solKey = k.slice("aportes_normativos.".length);
            next.aportes_normativos = { ...(prev.aportes_normativos || {}) };
            if (isFirestoreDeleteSentinel(v)) {
              delete next.aportes_normativos[solKey];
            } else {
              next.aportes_normativos[solKey] = v;
            }
          } else {
            next[k] = v;
          }
        }
        asiStore[id] = next;
      },
    };
  }

  const db = {
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return ref.get();
        },
        set(ref, data, opts) {
          return ref.set(data, opts);
        },
      };
      await fn(tx);
    },
    collection(name) {
      if (name === "solicitudes_articulo") {
        return {
          doc(id) {
            const ref = docRef(solStore, id);
            return {
              ...ref,
              async set(patch) {
                solStore[id] = { ...(solStore[id] || {}), ...patch };
              },
            };
          },
        };
      }
      if (name === "asistencia_diaria") {
        return {
          doc(id) {
            return asiDocRef(id);
          },
        };
      }
      if (name === "mdc_comandos_aplicados") {
        return {
          doc() {
            return {
              async delete() {},
              async get() {
                return { exists: false };
              },
              async set() {},
            };
          },
        };
      }
      if (name === "vistas_grilla_mes_agente") {
        return {
          doc(id) {
            return docRef(visStore, id);
          },
        };
      }
      if (name === "cfg_articulos") {
        return {
          doc() {
            return {
              async get() {
                return { exists: true, data: () => ({ codigo: "11-A", nombre: "Corta" }) };
              },
              collection() {
                return {
                  doc() {
                    return {
                      async get() {
                        return {
                          exists: true,
                          data: () => ({
                            bloque_identidad_naturaleza: {
                              visualizacion: { codigo_grilla: "11-A" },
                            },
                            bloque_topes_plazos_computo: { nivel_ocupacion_dia_id: "cfg_nod_exclusivo" },
                          }),
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
      if (name === "historial_laboral_grupos") {
        return {
          where() {
            return {
              async get() {
                return {
                  docs: [
                    {
                      id: "hlg_1",
                      data: () => ({
                        persona_id: "per_agente",
                        grupo_de_trabajo_id: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
                        fecha_desde: "2020-01-01",
                        activo: true,
                      }),
                    },
                  ],
                };
              },
            };
          },
        };
      }
      if (name === "grupos_de_trabajo") {
        return {
          doc() {
            return { async get() { return { exists: true, data: () => ({ nombre: "Sala" }) }; } };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    _asiStore: asiStore,
    _visStore: visStore,
  };

  return db;
}

describe("mutarEstadoSolicitudMedicaMdc — integración asi_*", () => {
  it("rechazo elimina aporte del sol_id sin duplicar claves", async () => {
    const asiId = "asi_per_agente_20260610";
    const db = makeDbConAsistencia({
      solDoc: {
        schema_version: "SOL_MED_AVISO_V1",
        titular_persona_id: "per_agente",
        estado_solicitud_id: "cfg_esa_rechazada",
        fecha_inicio_reposo_estimada: "2026-06-10",
        fecha_fin_reposo_estimada: "2026-06-10",
        grupo_trabajo_id_ancla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        ingreso_medico: { es_licencia_incompleta: false, adjuntos: [{}] },
      },
      asiAportesIniciales: {
        [asiId]: {
          aportes_normativos: {
            sol_test: { sol_id: "sol_test", codigo_grilla: "LM" },
            sol_otra: { sol_id: "sol_otra", codigo_grilla: "LAO" },
          },
        },
      },
    });

    const r = await mutarEstadoSolicitudMedicaMdc(db, {
      solicitudId: "sol_test",
      estadoDestino: "cfg_esa_rechazada",
      rangoProyeccionAnterior: { fecha_desde: "2026-06-10", fecha_hasta: "2026-06-10" },
    });

    assert.equal(r.ok, true);
    const asi = db._asiStore[asiId];
    assert.ok(asi);
    assert.equal(asi.aportes_normativos.sol_test, undefined);
    assert.ok(asi.aportes_normativos.sol_otra);
    assert.equal(Object.keys(asi.aportes_normativos).length, 1);
  });
});

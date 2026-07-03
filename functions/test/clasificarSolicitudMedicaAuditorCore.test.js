"use strict";

/**
 * node --test functions/test/clasificarSolicitudMedicaAuditorCore.test.js
 */
const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  CFG_MLM_CORTA_ANUAL,
  CFG_MLM_LARGA_EPISODIO,
} = require("../modules/shared/licenciaMedicaTramosCore");
const {
  planificarComandosMutacionMedicaAviso,
} = require("../modules/shared/mutarEstadoSolicitudMedicaMdc");
const {
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("../modules/shared/mdcComandosConstants");
const { SCHEMA_MED_AVISO } = require("../modules/shared/avisoMedicoCajaNegraCore");

const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const AUDITOR = "per_01AUDITOR_MEDICO_TEST";
const ART14 = "art_01KWH4NM0BW4HKGGWV1NFD599K";
const VER14 = "ver_01KWH4NM0CZWTQQMHKKPGBNRDP";
const ART16 = "art_01TEST_LARGA_EPISODIO";
const VER16 = "ver_01TEST_LARGA_EPISODIO";
const CAUSAL_LARGA = "cfg_cld_enfermedad";
const SOL_ID = "sol_01TEST_FECHAS_EDITABLES";

const versionCorta = {
  bloque_identidad_naturaleza: {
    es_licencia_medica: true,
    modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
    visualizacion: { codigo_grilla: "LM" },
  },
};

const versionLarga = {
  bloque_identidad_naturaleza: {
    es_licencia_medica: true,
    modo_licencia_medica_id: CFG_MLM_LARGA_EPISODIO,
    visualizacion: { codigo_grilla: "LM-L" },
  },
};

/** @type {Array<Record<string, unknown>>} */
const mdcCalls = [];
/** @type {Record<string, Record<string, unknown>>} */
let solStore = {};

const mdcMod = require("../modules/shared/mutarEstadoSolicitudMedicaMdc");
const mutarEstadoOriginal = mdcMod.mutarEstadoSolicitudMedicaMdc;

mdcMod.mutarEstadoSolicitudMedicaMdc = async (_db, input) => {
  mdcCalls.push({
    solicitudId: input.solicitudId,
    estadoDestino: input.estadoDestino,
    rangoProyeccionAnterior: input.rangoProyeccionAnterior
      ? { ...input.rangoProyeccionAnterior }
      : null,
  });
  return {
    ok: true,
    solicitud_id: input.solicitudId,
    estado_solicitud_id: input.estadoDestino,
    comandos: ["MOCK"],
    resultados: [],
  };
};

const aplicarMod = require("../modules/shared/aplicarLicenciaMedicaAprobadaCore");
const aplicarOriginal = aplicarMod.aplicarLicenciaMedicaAprobada;

aplicarMod.aplicarLicenciaMedicaAprobada = async (db, params) => {
  if (params?.modo_licencia_medica_id === CFG_MLM_LARGA_EPISODIO) {
    return {
      ok: true,
      licencia_medica: {
        modo_licencia_medica_id: CFG_MLM_LARGA_EPISODIO,
        dias_solicitud_total: params.dias_solicitados,
      },
      tramos_haberes: {},
      episodio_preview: { tope_episodio_dias: 365 },
    };
  }
  return aplicarOriginal(db, params);
};

const { clasificarSolicitudMedicaAuditor, diasCorridosInclusive } = require("../modules/shared/clasificarSolicitudMedicaAuditorCore");

after(() => {
  mdcMod.mutarEstadoSolicitudMedicaMdc = mutarEstadoOriginal;
  aplicarMod.aplicarLicenciaMedicaAprobada = aplicarOriginal;
});

function mergeSolPatch(sol, patch) {
  const next = { ...sol, ...patch };
  if (patch.auditor_medico_clasificacion && sol.auditor_medico_clasificacion) {
    next.auditor_medico_clasificacion = {
      ...sol.auditor_medico_clasificacion,
      ...patch.auditor_medico_clasificacion,
    };
  }
  if (patch.licencia_medica) {
    next.licencia_medica = patch.licencia_medica;
  }
  return next;
}

function buildAvisoBase() {
  return {
    schema_version: SCHEMA_MED_AVISO,
    estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
    titular_persona_id: PER,
    ingreso_medico: {
      es_licencia_incompleta: false,
      adjuntos: [{ storage_path: "avisos-med/2026/test/cert.pdf", nombre: "cert.pdf" }],
    },
    fecha_inicio_reposo_estimada: "2026-07-01",
    fecha_fin_reposo_estimada: "2026-07-10",
    grupo_trabajo_id_ancla: "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
  };
}

function buildMockDb(opts = {}) {
  const versionByArt = opts.versionByArt || { [ART14]: versionCorta, [ART16]: versionLarga };
  return {
    collection(name) {
      if (name === "solicitudes_articulo") {
        const filters = [];
        const chain = {
          where(field, _op, value) {
            filters.push([field, value]);
            return chain;
          },
          async get() {
            const rows = Object.entries(solStore).filter(([, data]) =>
              filters.every(([field, val]) => data[field] === val),
            );
            return {
              docs: rows.map(([id, data]) => ({ id, data: () => data })),
            };
          },
          doc(id) {
            return {
              async get() {
                const data = solStore[id];
                return {
                  exists: Boolean(data),
                  data: () => data || {},
                };
              },
              async update(patch) {
                if (!solStore[id]) throw new Error(`missing ${id}`);
                solStore[id] = mergeSolPatch(solStore[id], patch);
              },
            };
          },
        };
        return chain;
      }
      if (name === "cfg_articulos") {
        return {
          doc(id) {
            return {
              async get() {
                const is14 = id === ART14;
                const is16 = id === ART16;
                if (!is14 && !is16) return { exists: false, data: () => ({}) };
                return {
                  exists: true,
                  data: () => ({
                    codigo: is16 ? "16" : "14",
                    nombre: is16 ? "LICENCIA LARGA" : "ENFERMEDAD DE CORTA DURACION",
                  }),
                };
              },
              collection(sub) {
                if (sub !== "versiones") throw new Error(sub);
                return {
                  doc(verId) {
                    return {
                      async get() {
                        const verData =
                          verId === VER14
                            ? versionByArt[ART14]
                            : verId === VER16
                              ? versionByArt[ART16]
                              : null;
                        if (!verData) return { exists: false, data: () => ({}) };
                        return { exists: true, data: () => verData };
                      },
                    };
                  },
                };
              },
            };
          },
          where() {
            return { limit: () => ({ async get() { return { docs: [] }; } }) };
          },
          limit() {
            return { async get() { return { docs: [] }; } };
          },
        };
      }
      throw new Error(`colección no mockeada: ${name}`);
    },
  };
}

function inputClasificar(fechaDesde, fechaHasta, extra = {}) {
  return {
    solicitudId: SOL_ID,
    auditorPersonaId: AUDITOR,
    articuloId: ART14,
    versionIdAplicada: VER14,
    fechaDesde,
    fechaHasta,
    dictamenFavorable: true,
    ...extra,
  };
}

function inputClasificarLarga(fechaDesde, fechaHasta, extra = {}) {
  return {
    solicitudId: SOL_ID,
    auditorPersonaId: AUDITOR,
    articuloId: ART16,
    versionIdAplicada: VER16,
    fechaDesde,
    fechaHasta,
    causalLargaDuracionId: CAUSAL_LARGA,
    dictamenFavorable: true,
    ...extra,
  };
}

describe("diasCorridosInclusive", () => {
  it("cuenta días corridos", () => {
    assert.equal(diasCorridosInclusive("2026-06-10", "2026-06-12"), 3);
  });
});

describe("clasificarSolicitudMedicaAuditor", () => {
  beforeEach(() => {
    mdcCalls.length = 0;
    solStore = { [SOL_ID]: buildAvisoBase() };
  });

  it("rechaza aviso incompleto", async () => {
    solStore[SOL_ID] = {
      ...buildAvisoBase(),
      ingreso_medico: { es_licencia_incompleta: true, adjuntos: [] },
    };
    const r = await clasificarSolicitudMedicaAuditor(buildMockDb(), inputClasificar("2026-06-10", "2026-06-12"));
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "AVISO_INCOMPLETO");
  });

  it("P2b: acorta fechas dictaminadas y pasa rangoProyeccionAnterior original al MDC", async () => {
    const fechaDesde = "2026-07-01";
    const fechaHasta = "2026-07-05";

    const r = await clasificarSolicitudMedicaAuditor(buildMockDb(), inputClasificar(fechaDesde, fechaHasta));

    assert.equal(r.ok, true, r.codigo || r.mensaje || JSON.stringify(r));
    assert.equal(r.dias_solicitados, 5);
    assert.equal(r.estado_solicitud_id, "cfg_esa_aprobada");
    assert.equal(r.requiere_junta_medica, false);

    const sol = solStore[SOL_ID];
    assert.equal(sol.fecha_desde, fechaDesde);
    assert.equal(sol.fecha_hasta, fechaHasta);
    assert.equal(sol.dias_solicitados, 5);
    assert.equal(sol.auditor_medico_clasificacion?.fecha_desde, fechaDesde);
    assert.equal(sol.auditor_medico_clasificacion?.fecha_hasta, fechaHasta);
    assert.strictEqual(sol.auditor_medico_clasificacion?.fechas_corregidas_por_auditor, true);
    assert.strictEqual(r.auditor_medico_clasificacion?.fechas_corregidas_por_auditor, true);

    assert.equal(mdcCalls.length, 1);
    assert.deepEqual(mdcCalls[0].rangoProyeccionAnterior, {
      fecha_desde: "2026-07-01",
      fecha_hasta: "2026-07-10",
    });
    assert.equal(mdcCalls[0].estadoDestino, "cfg_esa_aprobada");

    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_aprobada",
      mdcCalls[0].rangoProyeccionAnterior,
      { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    );
    assert.equal(plan.comandos.length, 2);
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_REVERTIR_PROYECCION);
    assert.deepEqual(plan.comandos[0], {
      comando: MDC_COMANDO_REVERTIR_PROYECCION,
      fecha_desde: "2026-07-01",
      fecha_hasta: "2026-07-10",
    });
    assert.equal(plan.comandos[1].comando, MDC_COMANDO_CONSOLIDAR_APROBADO);
    assert.equal(plan.comandos[1].fecha_hasta, fechaHasta);
  });

  it("P2b: extiende fechas dictaminadas (>15 d) y deriva a junta con MDC revert+proyectar", async () => {
    const fechaDesde = "2026-07-01";
    const fechaHasta = "2026-07-16";

    const r = await clasificarSolicitudMedicaAuditor(buildMockDb(), inputClasificar(fechaDesde, fechaHasta));

    assert.equal(r.ok, true, r.codigo || r.mensaje || JSON.stringify(r));
    assert.equal(r.dias_solicitados, 16);
    assert.equal(r.estado_solicitud_id, "cfg_esa_esperando_dictamen_junta");
    assert.equal(r.requiere_junta_medica, true);

    const sol = solStore[SOL_ID];
    assert.equal(sol.fecha_hasta, fechaHasta);
    assert.equal(sol.dias_solicitados, 16);
    assert.strictEqual(sol.auditor_medico_clasificacion?.fechas_corregidas_por_auditor, true);
    assert.strictEqual(r.auditor_medico_clasificacion?.fechas_corregidas_por_auditor, true);

    assert.deepEqual(mdcCalls[0].rangoProyeccionAnterior, {
      fecha_desde: "2026-07-01",
      fecha_hasta: "2026-07-10",
    });
    assert.equal(mdcCalls[0].estadoDestino, "cfg_esa_esperando_dictamen_junta");

    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_esperando_dictamen_junta",
      mdcCalls[0].rangoProyeccionAnterior,
      { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    );
    assert.equal(plan.comandos.length, 2);
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_REVERTIR_PROYECCION);
    assert.equal(plan.comandos[1].comando, MDC_COMANDO_PROYECTAR_PENDIENTE);
    assert.equal(plan.comandos[1].fecha_hasta, fechaHasta);
  });

  it("P2b: fechas iguales al aviso → fechas_corregidas_por_auditor false", async () => {
    const r = await clasificarSolicitudMedicaAuditor(
      buildMockDb(),
      inputClasificar("2026-07-01", "2026-07-10"),
    );

    assert.equal(r.ok, true, r.codigo || r.mensaje || JSON.stringify(r));
    assert.strictEqual(r.auditor_medico_clasificacion?.fechas_corregidas_por_auditor, false);
    assert.strictEqual(solStore[SOL_ID].auditor_medico_clasificacion?.fechas_corregidas_por_auditor, false);
  });

  it("C2: larga sin CIE-10 falla CIE10_REQUERIDO", async () => {
    const r = await clasificarSolicitudMedicaAuditor(
      buildMockDb(),
      inputClasificarLarga("2026-07-01", "2026-07-05"),
    );
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "CIE10_REQUERIDO");
  });

  it("C2: auditor imputa CIE-10 en clasificación larga", async () => {
    const r = await clasificarSolicitudMedicaAuditor(
      buildMockDb(),
      inputClasificarLarga("2026-07-01", "2026-07-05", {
        cie10: { codigo: "J06.9", descripcion: "Infección aguda de vías respiratorias superiores" },
      }),
    );
    assert.equal(r.ok, true, r.codigo || r.mensaje || JSON.stringify(r));
    assert.equal(solStore[SOL_ID].cie10?.codigo, "J06.9");
    assert.equal(
      solStore[SOL_ID].auditor_medico_clasificacion?.cie10?.codigo,
      "J06.9",
    );
  });

  it("C2: corta con CIE-10 opcional del auditor persiste en sol_*", async () => {
    const r = await clasificarSolicitudMedicaAuditor(
      buildMockDb(),
      inputClasificar("2026-07-01", "2026-07-05", {
        cie10: { codigo: "J00", descripcion: "Rinofaringitis aguda" },
      }),
    );
    assert.equal(r.ok, true, r.codigo || r.mensaje || JSON.stringify(r));
    assert.equal(solStore[SOL_ID].cie10?.codigo, "J00");
  });
});

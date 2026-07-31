"use strict";

/**
 * node --test functions/test/solicitudBandejaRrhhListar.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseBandejaRrhhListOpts,
  itemPasaFiltroVista,
  paginarBandejaOrdenada,
  bandejaRrhhModoItem,
  estadosQueryPorVista,
  FILTRO_VISTA_PENDIENTES,
  FILTRO_VISTA_TODOS,
} = require("../modules/shared/solicitudBandejaRrhhCore");
const {
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
  ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
  ESTADO_SOLICITUD_RECHAZADA,
} = require("../modules/shared/solicitudesArticuloEstados");

describe("parseBandejaRrhhListOpts", () => {
  it("defaults: pendientes, page 10", () => {
    const o = parseBandejaRrhhListOpts({});
    assert.equal(o.filtroVista, "pendientes");
    assert.equal(o.pageSize, 10);
    assert.equal(o.cursor, "");
  });

  it("cap page_size en 50", () => {
    const o = parseBandejaRrhhListOpts({ page_size: 999 });
    assert.equal(o.pageSize, 50);
  });
});

describe("parseBandejaListPageOpts (jefe)", () => {
  const { parseBandejaListPageOpts } = require("../modules/shared/solicitudBandejaListUtils");
  it("default pendientes", () => {
    const o = parseBandejaListPageOpts({}, { filtroDefault: "pendientes" });
    assert.equal(o.filtroVista, "pendientes");
    assert.equal(o.pageSize, 10);
  });
});

describe("itemPasaFiltroVista", () => {
  it("pendientes solo accionables RRHH", () => {
    assert.equal(
      itemPasaFiltroVista({ puede_aprobar_rechazar: true, puede_registrar_toma_conocimiento: false }, FILTRO_VISTA_PENDIENTES),
      true,
    );
    assert.equal(
      itemPasaFiltroVista(
        { puede_aprobar_rechazar: false, puede_registrar_toma_conocimiento: false, bandeja_rrhh_modo: "visibilidad_jefe" },
        FILTRO_VISTA_PENDIENTES,
      ),
      false,
    );
  });

  it("aprobados por estado catálogo", () => {
    assert.equal(
      itemPasaFiltroVista({ estado_solicitud_id: ESTADO_SOLICITUD_APROBADA }, "aprobados"),
      true,
    );
  });

  it("la rechazada solo sale en rechazados y en todos", () => {
    const item = { estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA, bandeja_rrhh_modo: "rechazada" };
    assert.equal(itemPasaFiltroVista(item, "rechazados"), true);
    assert.equal(itemPasaFiltroVista(item, FILTRO_VISTA_TODOS), true);
    assert.equal(itemPasaFiltroVista(item, FILTRO_VISTA_PENDIENTES), false);
    assert.equal(itemPasaFiltroVista(item, "aprobados"), false);
  });
});

describe("estadosQueryPorVista", () => {
  it("todos cubre el catálogo presentado y deja afuera el borrador", () => {
    const estados = estadosQueryPorVista(FILTRO_VISTA_TODOS);
    for (const est of [
      ESTADO_SOLICITUD_EN_REVISION_JEFE,
      ESTADO_SOLICITUD_APROBADA,
      ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
      ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
      ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
      ESTADO_SOLICITUD_RECHAZADA,
    ]) {
      assert.ok(estados.includes(est), `falta ${est} en la vista todos`);
    }
    assert.equal(estados.includes(ESTADO_SOLICITUD_BORRADOR), false);
    // Firestore acota el operador `in`; muy lejos del tope, pero conviene saberlo.
    assert.ok(estados.length <= 30);
  });

  it("cada vista acotada pide solo sus estados, sin gastar el escaneo", () => {
    assert.deepEqual(estadosQueryPorVista("rechazados"), [ESTADO_SOLICITUD_RECHAZADA]);
    assert.deepEqual(estadosQueryPorVista("circuito_medico"), [
      ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
      ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
    ]);
    assert.deepEqual(estadosQueryPorVista("huerfanas"), [ESTADO_SOLICITUD_EN_REVISION_JEFE]);
    assert.deepEqual(estadosQueryPorVista("toma_conocimiento_pendiente"), [
      ESTADO_SOLICITUD_APROBADA,
    ]);
  });

  it("vista desconocida cae en los estados accionables", () => {
    assert.deepEqual(
      estadosQueryPorVista("inventada"),
      estadosQueryPorVista(FILTRO_VISTA_PENDIENTES),
    );
  });
});

describe("bandejaRrhhModoItem", () => {
  it("la rechazada muestra etiqueta legible, no el id del catálogo", () => {
    const modo = bandejaRrhhModoItem({ estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA });
    assert.equal(modo.modo, "rechazada");
    assert.equal(modo.etiqueta_estado, "Rechazada");
    assert.equal(modo.puede_aprobar_rechazar, false);
    assert.equal(modo.puede_registrar_toma_conocimiento, false);
  });

  it("aprobada sin TC queda accionable para RRHH", () => {
    const modo = bandejaRrhhModoItem({ estado_solicitud_id: ESTADO_SOLICITUD_APROBADA });
    assert.equal(modo.modo, "toma_conocimiento");
    assert.equal(modo.puede_registrar_toma_conocimiento, true);
  });

  it("los estados del circuito médico y la aplicación pendiente tienen etiqueta propia", () => {
    assert.equal(
      bandejaRrhhModoItem({ estado_solicitud_id: ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA })
        .etiqueta_estado,
      "En auditoría médica",
    );
    assert.equal(
      bandejaRrhhModoItem({ estado_solicitud_id: ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA })
        .etiqueta_estado,
      "En junta médica",
    );
    assert.equal(
      bandejaRrhhModoItem({ estado_solicitud_id: ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION })
        .etiqueta_estado,
      "Aprobada — pendiente de aplicación",
    );
  });

  it("ningún estado presentado cae en el volcado del id crudo", () => {
    for (const est of [
      ESTADO_SOLICITUD_EN_REVISION_JEFE,
      ESTADO_SOLICITUD_APROBADA,
      ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
      ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
      ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
      ESTADO_SOLICITUD_RECHAZADA,
    ]) {
      const modo = bandejaRrhhModoItem({ estado_solicitud_id: est });
      assert.notEqual(modo.modo, "otro", `${est} sin etiqueta propia`);
      assert.notEqual(modo.etiqueta_estado, est);
    }
  });
});

describe("paginarBandejaOrdenada", () => {
  const rows = [
    { solicitud_id: "sol_a", fecha_desde: "2026-01-01" },
    { solicitud_id: "sol_b", fecha_desde: "2026-02-01" },
    { solicitud_id: "sol_c", fecha_desde: "2026-03-01" },
  ];

  it("primera página", () => {
    const p = paginarBandejaOrdenada(rows, { cursor: "", pageSize: 2 });
    assert.equal(p.solicitudes.length, 2);
    assert.equal(p.solicitudes[0].solicitud_id, "sol_a");
    assert.equal(p.has_more, true);
    assert.equal(p.next_cursor, "sol_b");
  });

  it("cursor después del último id", () => {
    const p = paginarBandejaOrdenada(rows, { cursor: "sol_b", pageSize: 2 });
    assert.equal(p.solicitudes.length, 1);
    assert.equal(p.solicitudes[0].solicitud_id, "sol_c");
    assert.equal(p.has_more, false);
  });
});

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
  FILTRO_VISTA_PENDIENTES,
} = require("../modules/shared/solicitudBandejaRrhhCore");
const { ESTADO_SOLICITUD_APROBADA } = require("../modules/shared/solicitudesArticuloEstados");

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

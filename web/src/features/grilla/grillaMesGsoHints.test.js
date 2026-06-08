import { describe, it, expect } from "vitest";
import {
  COPY_TEORIA_PENDIENTE,
  copyPostPurgeHlg,
  evaluarImputacionExternaCelda,
  evaluarLicenciaEnFrancoCelda,
  evaluarPostPurgeHlgCelda,
  evaluarTeoriaPendienteLazyCelda,
} from "./grillaMesGsoHints.js";

describe("grillaMesGsoHints US-4", () => {
  const eventos = [
    {
      solicitud_id: "sol_1",
      codigo_grilla: "LAO-2026",
      grupo_trabajo_id_ancla: "gdt_sala",
    },
  ];

  it("detecta imputación externa con tooltip acta", () => {
    const r = evaluarImputacionExternaCelda(eventos, "gdt_oficina", {
      gdt_sala: "Sala Internación 1",
    });
    expect(r.activo).toBe(true);
    expect(r.tooltip).toBe("Licencia gestionada en otro sector (Sala Internación 1)");
  });

  it("no activa si ancla coincide con vista", () => {
    const r = evaluarImputacionExternaCelda(eventos, "gdt_sala", {});
    expect(r.activo).toBe(false);
  });
});

describe("grillaMesGsoHints US-5", () => {
  it("copy Q3-2 con fecha", () => {
    expect(copyPostPurgeHlg("2026-06-10")).toBe(
      "Sin dotación en este grupo desde el 10/06/2026. Licencias del período anterior conservadas.",
    );
  });

  it("post-purge por día posterior a vigente_hasta", () => {
    const r = evaluarPostPurgeHlgCelda(
      { tipo_dia: "laborable", rda_turno_id: "M" },
      [{ codigo_grilla: "LAO" }],
      { fechaYmd: "2026-06-15", vigenteHasta: "2026-06-10" },
    );
    expect(r.activo).toBe(true);
    expect(r.tooltip).toContain("10/06/2026");
  });

  it("post-purge por no_laborable sin jornada con licencia", () => {
    const r = evaluarPostPurgeHlgCelda(
      { tipo_dia: "no_laborable" },
      [{ codigo_grilla: "LAO" }],
      { vigenteHasta: "2026-06-10" },
    );
    expect(r.activo).toBe(true);
  });
});

describe("grillaMesGsoHints US-6", () => {
  const eventos = [{ codigo_grilla: "64-A", solicitud_id: "sol_1" }];

  it("activa con lazy y laborable sin jornada", () => {
    const r = evaluarTeoriaPendienteLazyCelda(
      { tipo_dia: "laborable" },
      eventos,
      { materializadoLazy: true },
    );
    expect(r.activo).toBe(true);
    expect(r.tooltip).toBe(COPY_TEORIA_PENDIENTE);
  });

  it("activa con solo eventos sin tipo_dia laborable", () => {
    const r = evaluarTeoriaPendienteLazyCelda({}, eventos, {});
    expect(r.activo).toBe(true);
  });

  it("no activa si hay jornada", () => {
    const r = evaluarTeoriaPendienteLazyCelda(
      { tipo_dia: "laborable", rda_turno_id: "M" },
      eventos,
      { materializadoLazy: true },
    );
    expect(r.activo).toBe(false);
  });

  it("no activa laborable sin lazy (escenario B, no G)", () => {
    const r = evaluarTeoriaPendienteLazyCelda({ tipo_dia: "laborable" }, eventos, {});
    expect(r.activo).toBe(false);
  });
});

describe("grillaMesGsoHints US-7", () => {
  it("hint licencia en franco", () => {
    const r = evaluarLicenciaEnFrancoCelda(
      { es_franco: true, tipo_dia: "franco" },
      [{ codigo_grilla: "LAO" }],
    );
    expect(r.activo).toBe(true);
  });
});

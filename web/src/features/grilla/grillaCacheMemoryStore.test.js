import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import {
  buildGrillaVistaCacheKey,
  createGrillaCacheMemoryStore,
  invalidateGrillaCacheGrupoMes,
} from "./grillaCacheMemoryStore.js";

describe("buildGrillaVistaCacheKey", () => {
  it("arma clave GDT + período + modo equipo", () => {
    expect(
      buildGrillaVistaCacheKey({
        grupoTrabajoId: "gdt_01ABC",
        anio: 2026,
        mes: 6,
        modo: GRILLA_MES_MODO.EQUIPO,
      }),
    ).toBe("gdt_gdt_01ABC_per_2026_06_mod_EQUIPO");
  });

  it("incluye persona en modo titular", () => {
    const key = buildGrillaVistaCacheKey({
      grupoTrabajoId: "gdt_X",
      anio: 2026,
      mes: 3,
      modo: GRILLA_MES_MODO.TITULAR,
      personaId: "per_1",
    });
    expect(key).toContain("_mod_TITULAR");
    expect(key).toContain("_tit_per_1");
  });
});

describe("createGrillaCacheMemoryStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("miss → undefined; set → hit", () => {
    const store = createGrillaCacheMemoryStore({ ttlMs: 60_000 });
    const key = "gdt_gdt_1_per_2026_06_mod_EQUIPO";
    expect(store.has(key)).toBe(false);
    expect(store.get(key)).toBeUndefined();

    const payload = { filas: [{ persona_id: "p1" }] };
    store.set(key, payload);
    expect(store.has(key)).toBe(true);
    expect(store.get(key)).toBe(payload);
    expect(store.size()).toBe(1);
  });

  it("TTL expira entrada (miss tras ventana)", () => {
    const store = createGrillaCacheMemoryStore({ ttlMs: 1000 });
    const key = "k1";
    store.set(key, { ok: true });
    expect(store.get(key)).toEqual({ ok: true });

    vi.advanceTimersByTime(1001);
    expect(store.has(key)).toBe(false);
    expect(store.get(key)).toBeUndefined();
  });

  it("invalidateGrupoMes elimina modos del mismo mes sin tocar otro GDT", () => {
    const store = createGrillaCacheMemoryStore({ ttlMs: null });
    const gdt = "gdt_01KQA";
    const kEquipo = buildGrillaVistaCacheKey({
      grupoTrabajoId: gdt,
      anio: 2026,
      mes: 6,
      modo: GRILLA_MES_MODO.EQUIPO,
    });
    const kSector = buildGrillaVistaCacheKey({
      grupoTrabajoId: gdt,
      anio: 2026,
      mes: 6,
      modo: GRILLA_MES_MODO.SECTOR,
    });
    const kOtroMes = buildGrillaVistaCacheKey({
      grupoTrabajoId: gdt,
      anio: 2026,
      mes: 7,
      modo: GRILLA_MES_MODO.EQUIPO,
    });
    const kOtroGdt = buildGrillaVistaCacheKey({
      grupoTrabajoId: "gdt_OTRO",
      anio: 2026,
      mes: 6,
      modo: GRILLA_MES_MODO.EQUIPO,
    });

    store.set(kEquipo, { a: 1 });
    store.set(kSector, { b: 2 });
    store.set(kOtroMes, { c: 3 });
    store.set(kOtroGdt, { d: 4 });

    const removed = store.invalidateGrupoMes(gdt, 2026, 6);
    expect(removed).toBe(2);
    expect(store.has(kEquipo)).toBe(false);
    expect(store.has(kSector)).toBe(false);
    expect(store.has(kOtroMes)).toBe(true);
    expect(store.has(kOtroGdt)).toBe(true);
  });

  it("invalidateGrupoPeriodo desde YYYY-MM", () => {
    const store = createGrillaCacheMemoryStore({ ttlMs: null });
    const key = buildGrillaVistaCacheKey({
      grupoTrabajoId: "gdt_Z",
      anio: 2026,
      mes: 11,
      modo: GRILLA_MES_MODO.EQUIPO,
    });
    store.set(key, { x: 1 });
    store.invalidateGrupoPeriodo("gdt_Z", "2026-11");
    expect(store.has(key)).toBe(false);
  });

  it("delete y clear", () => {
    const store = createGrillaCacheMemoryStore({ ttlMs: null });
    store.set("a", 1);
    store.set("b", 2);
    expect(store.delete("a")).toBe(true);
    expect(store.size()).toBe(1);
    store.clear();
    expect(store.size()).toBe(0);
  });
});

describe("invalidateGrillaCacheGrupoMes (mapa crudo)", () => {
  it("respeta prefijo gdt + per", () => {
    const map = new Map([
      ["gdt_g1_per_2026_06_mod_EQUIPO", 1],
      ["gdt_g1_per_2026_06_mod_SECTOR", 2],
      ["gdt_g1_per_2026_05_mod_EQUIPO", 3],
    ]);
    expect(invalidateGrillaCacheGrupoMes(map, "g1", 2026, 6)).toBe(2);
    expect(map.size).toBe(1);
  });
});

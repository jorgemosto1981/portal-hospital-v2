import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCatalogoLaboralCacheKey,
  createCatalogoLaboralCacheMemoryStore,
} from "./catalogoLaboralCacheStore.js";

describe("buildCatalogoLaboralCacheKey", () => {
  it("incluye colección y límite", () => {
    expect(buildCatalogoLaboralCacheKey("grupos_de_trabajo", 400)).toBe(
      "laboral:grupos_de_trabajo:l400",
    );
    expect(buildCatalogoLaboralCacheKey("grupos_de_trabajo", 800)).toBe(
      "laboral:grupos_de_trabajo:l800",
    );
  });

  it("distingue sin límite", () => {
    expect(buildCatalogoLaboralCacheKey("cargos", null)).toBe("laboral:cargos:all");
  });
});

describe("createCatalogoLaboralCacheMemoryStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("miss → set → hit", () => {
    const store = createCatalogoLaboralCacheMemoryStore({ ttlMs: 60_000 });
    const key = buildCatalogoLaboralCacheKey("grupos_de_trabajo", 400);
    expect(store.has(key)).toBe(false);

    const rows = [{ id: "g1" }];
    store.set(key, rows);
    expect(store.get(key)).toBe(rows);
    expect(store.size()).toBe(1);
  });

  it("TTL expira entrada", () => {
    const store = createCatalogoLaboralCacheMemoryStore({ ttlMs: 1000 });
    const key = "laboral:test:l1";
    store.set(key, [1]);
    vi.advanceTimersByTime(1001);
    expect(store.has(key)).toBe(false);
  });
});

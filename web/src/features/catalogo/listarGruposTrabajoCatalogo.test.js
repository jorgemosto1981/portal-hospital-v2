import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCatalogoLaboralCacheKey } from "./catalogoLaboralCacheStore.js";
import { catalogoLaboralCacheStore } from "./catalogoLaboralCacheStore.js";
import { listarGruposTrabajoCatalogo } from "./listarGruposTrabajoCatalogo.js";

vi.mock("../../services/datosLaboralesService.js", () => ({
  listarColeccionLaboral: vi.fn(),
}));

import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";

describe("listarGruposTrabajoCatalogo", () => {
  const key400 = buildCatalogoLaboralCacheKey("grupos_de_trabajo", 400);

  beforeEach(() => {
    catalogoLaboralCacheStore.clear();
    vi.mocked(listarColeccionLaboral).mockReset();
  });

  afterEach(() => {
    catalogoLaboralCacheStore.clear();
  });

  it("llama red una vez y reutiliza caché", async () => {
    const rows = [{ id: "g1", activo: true }];
    vi.mocked(listarColeccionLaboral).mockResolvedValue(rows);

    const a = await listarGruposTrabajoCatalogo({ limit: 400 });
    const b = await listarGruposTrabajoCatalogo({ limit: 400 });

    expect(a).toBe(rows);
    expect(b).toBe(rows);
    expect(listarColeccionLaboral).toHaveBeenCalledTimes(1);
    expect(catalogoLaboralCacheStore.get(key400)).toBe(rows);
  });

  it("bypassCache fuerza nueva red", async () => {
    vi.mocked(listarColeccionLaboral)
      .mockResolvedValueOnce([{ id: "a" }])
      .mockResolvedValueOnce([{ id: "b" }]);

    await listarGruposTrabajoCatalogo({ limit: 400 });
    const fresh = await listarGruposTrabajoCatalogo({ limit: 400, bypassCache: true });

    expect(fresh).toEqual([{ id: "b" }]);
    expect(listarColeccionLaboral).toHaveBeenCalledTimes(2);
  });

  it("coalesce requests concurrentes", async () => {
    let resolveFetch;
    const deferred = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(listarColeccionLaboral).mockReturnValue(deferred);

    const p1 = listarGruposTrabajoCatalogo({ limit: 400 });
    const p2 = listarGruposTrabajoCatalogo({ limit: 400 });

    resolveFetch([{ id: "x" }]);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual([{ id: "x" }]);
    expect(r2).toEqual([{ id: "x" }]);
    expect(listarColeccionLaboral).toHaveBeenCalledTimes(1);
  });
});

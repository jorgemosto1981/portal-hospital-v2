"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { asyncMapLimite } = require("../modules/shared/asyncMapLimite");
const {
  crearCacheAutorizacion,
  memoAsync,
} = require("../modules/shared/solicitudAutorizacionCache");

const tick = () => new Promise((r) => setTimeout(r, 0));

test("asyncMapLimite", async (t) => {
  await t.test("preserva el orden de entrada", async () => {
    const out = await asyncMapLimite([1, 2, 3, 4, 5], 2, async (n) => {
      await new Promise((r) => setTimeout(r, (6 - n) * 2));
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
  });

  await t.test("no excede el límite de tareas en vuelo", async () => {
    let enVuelo = 0;
    let pico = 0;
    await asyncMapLimite(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      enVuelo += 1;
      pico = Math.max(pico, enVuelo);
      await tick();
      enVuelo -= 1;
    });
    assert.equal(pico, 3);
  });

  await t.test("lista vacía no invoca fn", async () => {
    let llamadas = 0;
    const out = await asyncMapLimite([], 5, async () => {
      llamadas += 1;
    });
    assert.deepEqual(out, []);
    assert.equal(llamadas, 0);
  });

  await t.test("propaga el error de fn", async () => {
    await assert.rejects(
      () => asyncMapLimite([1, 2], 2, async () => {
        throw new Error("boom");
      }),
      /boom/,
    );
  });
});

test("memoAsync", async (t) => {
  await t.test("una sola ejecución por clave", async () => {
    const cache = new Map();
    let llamadas = 0;
    const fn = async () => {
      llamadas += 1;
      return "v";
    };
    assert.equal(await memoAsync(cache, "k", fn), "v");
    assert.equal(await memoAsync(cache, "k", fn), "v");
    assert.equal(llamadas, 1);
  });

  await t.test("deduplica llamadas concurrentes en vuelo", async () => {
    const cache = new Map();
    let llamadas = 0;
    const fn = async () => {
      llamadas += 1;
      await tick();
      return "v";
    };
    const [a, b, c] = await Promise.all([
      memoAsync(cache, "k", fn),
      memoAsync(cache, "k", fn),
      memoAsync(cache, "k", fn),
    ]);
    assert.deepEqual([a, b, c], ["v", "v", "v"]);
    assert.equal(llamadas, 1);
  });

  await t.test("no cachea el error: libera la clave", async () => {
    const cache = new Map();
    await assert.rejects(
      () => memoAsync(cache, "k", async () => {
        throw new Error("falla");
      }),
      /falla/,
    );
    assert.equal(cache.has("k"), false);
    assert.equal(await memoAsync(cache, "k", async () => "ok"), "ok");
  });

  await t.test("sin caché ejecuta siempre", async () => {
    let llamadas = 0;
    const fn = async () => {
      llamadas += 1;
      return 1;
    };
    await memoAsync(null, "k", fn);
    await memoAsync(undefined, "k", fn);
    assert.equal(llamadas, 2);
  });
});

test("crearCacheAutorizacion expone los cuatro mapas independientes", () => {
  const c = crearCacheAutorizacion();
  assert.deepEqual(Object.keys(c).sort(), [
    "cadena",
    "grupoTrabajo",
    "hlgPorGrupo",
    "hlgPorPersona",
  ]);
  for (const m of Object.values(c)) assert.ok(m instanceof Map);
  c.hlgPorGrupo.set("gdt_1", Promise.resolve([]));
  assert.equal(c.hlgPorPersona.size, 0);
});

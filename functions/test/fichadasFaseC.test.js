/**
 * Fase C — transacciones, concurrencia, dirty check / evt.
 * node --test functions/test/fichadasFaseC.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const capaCore = require(join(dirname(fileURLToPath(import.meta.url)), "../modules/fichadas/fichadasCapaDiaCore.js"));
const marcasUtils = require(join(dirname(fileURLToPath(import.meta.url)), "../modules/fichadas/fichadasMarcasUtils.js"));
const {
  agruparMarcasPorClaveVis,
  claveVisImportMarca,
  parseLineaRelojBiometrico,
} = require(join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/fichadasValidacionMarcas.js"));

describe("validarVersionCeldaFichada (concurrencia)", () => {
  it("lanza failed-precondition si version_esperada no coincide", () => {
    assert.throws(
      () => marcasUtils.validarVersionCeldaFichada({ fichadas_reales_version: 3 }, 2),
      (err) => err.code === "failed-precondition",
    );
  });

  it("no lanza si version_esperada es null", () => {
    marcasUtils.validarVersionCeldaFichada({ fichadas_reales_version: 3 }, null);
  });
});

describe("construirPatchCeldaDia — dirty check / evt", () => {
  it("write_skipped sin delta → no dispara write ni evt en flujo guardar", () => {
    const celdaAntes = {
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
      advertencias_fichada_abiertas: [],
    };
    const patch = capaCore.construirPatchCeldaDia({
      celdaAntes,
      alineado: {
        fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
        advertencias_fichada_abiertas: [],
      },
      accion: "REEMPLAZAR_MARCAS",
      motivo: "re-import idéntico",
      actor_persona_id: "per_test",
      origen: "GRILLA_ABM",
    });
    assert.equal(patch.write_skipped, true);
    assert.equal(patch.tiene_delta, false);
  });

  it("BORRAR_CAPA con marcas previas genera delta y snapshot lógico", () => {
    const celdaAntes = {
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
      advertencias_fichada_abiertas: [],
      fichadas_borradas: [],
    };
    const patch = capaCore.construirPatchCeldaDia({
      celdaAntes,
      alineado: { fichadas_reales: [], advertencias_fichada_abiertas: [] },
      accion: "BORRAR_CAPA",
      motivo: "error carga",
      actor_persona_id: "per_rrhh",
      origen: "GRILLA_ABM",
      snapshotBorrado: celdaAntes.fichadas_reales,
    });
    assert.equal(patch.write_skipped, false);
    assert.equal(patch.celdaNueva.fichadas_reales.length, 0);
    assert.equal(patch.celdaNueva.fichadas_borradas.length, 1);
  });
});

describe("aplicarImport map-reduce (agrupación vis)", () => {
  it("muchas líneas del mismo agente/mes → una clave vis", () => {
    const persona_id = "per_IMPORT";
    const grupo_trabajo_id = "gdt_IMPORT";
    const marcas = [];
    for (let i = 0; i < 40; i += 1) {
      const p = parseLineaRelojBiometrico(`00123 10/06/26 06:${String(i % 60).padStart(2, "0")} 001 01`);
      assert.equal(p.ok, true);
      marcas.push({ ...p, persona_id, grupo_trabajo_id });
    }
    const map = agruparMarcasPorClaveVis(marcas, (m) =>
      claveVisImportMarca(m, { persona_id, grupo_trabajo_id }),
    );
    assert.equal(map.size, 1);
  });
});

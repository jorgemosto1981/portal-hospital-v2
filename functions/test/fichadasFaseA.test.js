/**
 * Fase A — parser TXT, duplicados, delta, map-reduce.
 * node --test functions/test/fichadasFaseA.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharedDir = join(dirname(fileURLToPath(import.meta.url)), "../modules/shared");

const {
  parseLineaRelojBiometrico,
  parseTxtRelojBiometrico,
  instanteMarcaInstitucionalMs,
  detectarDuplicadosProbablesEnLote,
  marcasSonDuplicadoProbable,
  agruparMarcasPorClaveVis,
  claveVisImportMarca,
  CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE,
  ZONA_HORARIA_INSTITUCIONAL,
} = require(join(sharedDir, "fichadasValidacionMarcas.js"));

const {
  evaluarDeltaCeldaDia,
  segmentarOperacionesFirestore,
  FIRESTORE_BATCH_SAFE_MAX,
} = require(join(sharedDir, "fichadasDeltaCeldaDia.js"));

describe("parseLineaRelojBiometrico", () => {
  it("parsea máscara TTTTT DD/MM/YY HH:MM RRR CC en zona BA", () => {
    const r = parseLineaRelojBiometrico("00123 13/06/26 06:05 001 01");
    assert.equal(r.ok, true);
    assert.equal(r.numero_tarjeta, "00123");
    assert.equal(r.fecha_ymd, "2026-06-13");
    assert.equal(r.hora_hm, "06:05");
    assert.equal(r.numero_reloj, "001");
    assert.equal(r.codigo_dispositivo, "01");
    assert.equal(r.zona_horaria, ZONA_HORARIA_INSTITUCIONAL);
    assert.equal(r.instante_ms, instanteMarcaInstitucionalMs("2026-06-13", "06:05"));
  });

  it("rechaza línea mal formada", () => {
    const r = parseLineaRelojBiometrico("solo texto");
    assert.equal(r.ok, false);
  });
});

describe("detectarDuplicadosProbablesEnLote", () => {
  it("marca MARCA_DUPLICADA_PROBABLE si Δt < 2 min mismo día/tarjeta", () => {
    const a = parseLineaRelojBiometrico("00123 13/06/26 06:05 001 01");
    const b = parseLineaRelojBiometrico("00123 13/06/26 06:06 001 01");
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    const out = detectarDuplicadosProbablesEnLote([a, b]);
    assert.equal(out[0].advertencias.length, 0);
    assert.deepEqual(out[1].advertencias, [CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE]);
  });

  it("no marca duplicado si Δt >= umbral", () => {
    const a = parseLineaRelojBiometrico("00123 13/06/26 06:05 001 01");
    const b = parseLineaRelojBiometrico("00123 13/06/26 06:08 001 01");
    const out = detectarDuplicadosProbablesEnLote([a, b], { umbral_duplicado_minutos: 2 });
    assert.equal(out[1].advertencias.length, 0);
    assert.equal(marcasSonDuplicadoProbable(a, b, 2), false);
  });
});

describe("agruparMarcasPorClaveVis (map-reduce import)", () => {
  it("80 líneas del mismo agente/mes colapsan en 1 clave vis_*", () => {
    const persona_id = "per_TEST";
    const grupo_trabajo_id = "gdt_TEST";
    const vis_id = "vis_TEST_JUNIO";
    const marcas = [];
    for (let d = 1; d <= 20; d += 1) {
      for (let n = 0; n < 4; n += 1) {
        const dd = String(d).padStart(2, "0");
        const h = String(6 + n).padStart(2, "0");
        const p = parseLineaRelojBiometrico(`00123 ${dd}/06/26 ${h}:05 001 01`);
        assert.equal(p.ok, true);
        marcas.push({
          ...p,
          persona_id,
          grupo_trabajo_id,
        });
      }
    }
    assert.equal(marcas.length, 80);
    const grupos = agruparMarcasPorClaveVis(marcas, (m) =>
      claveVisImportMarca(m, { vis_id, persona_id, grupo_trabajo_id }),
    );
    assert.equal(grupos.size, 1);
    assert.equal(grupos.get(vis_id).length, 80);
  });
});

describe("evaluarDeltaCeldaDia (§15.2C)", () => {
  it("write_skipped si marcas y advertencias idénticas", () => {
    const snap = {
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
      advertencias_fichada_abiertas: ["NOCTURNIDAD_AMBIGUA"],
    };
    const r = evaluarDeltaCeldaDia({
      fichadas_reales_antes: snap.fichadas_reales,
      fichadas_reales_despues: [{ egreso: "14:00", ingreso: "06:05" }],
      advertencias_antes: snap.advertencias_fichada_abiertas,
      advertencias_despues: ["NOCTURNIDAD_AMBIGUA"],
    });
    assert.equal(r.write_skipped, true);
    assert.equal(r.tiene_delta, false);
  });

  it("tiene_delta si cambian advertencias", () => {
    const r = evaluarDeltaCeldaDia({
      fichadas_reales_antes: [],
      fichadas_reales_despues: [],
      advertencias_antes: [],
      advertencias_despues: ["MARCA_DUPLICADA_PROBABLE"],
    });
    assert.equal(r.tiene_delta, true);
  });
});

describe("segmentarOperacionesFirestore (§15.2D)", () => {
  it("600 ops → 2 batches de 400 y 200", () => {
    const ops = Array.from({ length: 600 }, (_, i) => i);
    const chunks = segmentarOperacionesFirestore(ops, FIRESTORE_BATCH_SAFE_MAX);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 400);
    assert.equal(chunks[1].length, 200);
  });
});

describe("parseTxtRelojBiometrico", () => {
  it("ignora líneas vacías y comentarios", () => {
    const txt = `# header
00123 13/06/26 06:05 001 01

00123 13/06/26 14:02 001 02`;
    const rows = parseTxtRelojBiometrico(txt);
    assert.equal(rows.length, 2);
    assert.equal(rows.every((r) => r.ok), true);
  });
});

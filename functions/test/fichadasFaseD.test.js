/**
 * Fase D — preview import en memoria.
 * node --test functions/test/fichadasFaseD.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { previsualizarImportFichadasReloj } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/fichadas/fichadasPreviewImportCore.js"),
);
const { CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/fichadasValidacionMarcas.js"),
);

describe("previsualizarImportFichadasReloj", () => {
  it("sin Firestore: parsea, duplicados y sin persona", () => {
    const txt = [
      "00123 13/06/26 06:05 001 01",
      "00123 13/06/26 06:06 001 01",
      "00999 13/06/26 08:00 001 02",
    ].join("\n");
    const r = previsualizarImportFichadasReloj({
      contenido_txt: txt,
      politica_duplicados: "EXCLUIR_SEGUNDA",
      enrolamiento_por_tarjeta: {
        "00123": { persona_id: "per_a", persona_label: "Agente A" },
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.filas.length, 3);
    const dup = r.filas.find((f) => f.numero_linea === 2);
    assert.ok(dup.advertencias.includes(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE));
    assert.equal(dup.incluir_por_defecto, false);
    const huerfana = r.filas.find((f) => f.numero_tarjeta === "00999");
    assert.equal(huerfana.persona_label, "Sin Persona");
    assert.equal(r.resumen.sin_persona, 1);
  });

  it("BLOQUEAR_APLICAR si hay duplicados", () => {
    const txt = "00123 13/06/26 06:05 001 01\n00123 13/06/26 06:06 001 01";
    const r = previsualizarImportFichadasReloj({
      contenido_txt: txt,
      politica_duplicados: "BLOQUEAR_APLICAR",
    });
    assert.equal(r.resumen.bloquear_aplicar, true);
  });
});

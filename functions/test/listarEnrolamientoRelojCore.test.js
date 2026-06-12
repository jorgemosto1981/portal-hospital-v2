/**
 * node --test functions/test/listarEnrolamientoRelojCore.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { normalizarPersonaId } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/fichadas/listarEnrolamientoRelojCore.js"),
);

describe("listarEnrolamientoRelojCore", () => {
  it("normalizarPersonaId agrega prefijo per_", () => {
    assert.equal(normalizarPersonaId("per_abc"), "per_abc");
    assert.equal(normalizarPersonaId("28914247"), "per_28914247");
  });
});

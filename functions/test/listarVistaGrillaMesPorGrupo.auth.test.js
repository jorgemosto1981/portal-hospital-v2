"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("listarVistaGrillaMesPorGrupo callable (T-05 auth)", () => {
  it("exige assertPlanAuth leer salvo OPEN_ACCESS_TEMP", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../onCall/grilla/listarVistaGrillaMesPorGrupo.js"),
      "utf8",
    );
    assert.match(src, /assertPlanAuth\(request,\s*grupoTrabajoId,\s*"leer"\)/);
    assert.match(src, /OPEN_ACCESS_TEMP/);
  });
});

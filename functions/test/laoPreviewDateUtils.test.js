"use strict";

/**
 * node --test functions/test/laoPreviewDateUtils.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { civilDateInZonaToUtcAnchorMs } = require("../modules/shared/fechaInstitucionalBa");
const {
  parseYmd,
  anchorFromYmd,
  mergeClosedIntervals,
} = require("../modules/shared/laoPreviewDateUtils");

describe("laoPreviewDateUtils", () => {
  it("parseYmd válido e inválido", () => {
    assert.deepEqual(parseYmd("2026-05-23"), { y: 2026, mo: 5, d: 23 });
    assert.equal(parseYmd("invalid"), null);
  });

  it("anchorFromYmd coherente con calendario BA", () => {
    const a = anchorFromYmd("2026-07-01");
    const b = civilDateInZonaToUtcAnchorMs(2026, 7, 1);
    assert.equal(a, b);
  });

  it("mergeClosedIntervals fusiona solapes adyacentes", () => {
    const i1 = {
      inicioUtc: civilDateInZonaToUtcAnchorMs(2026, 1, 1),
      finUtc: civilDateInZonaToUtcAnchorMs(2026, 1, 5),
    };
    const i2 = {
      inicioUtc: civilDateInZonaToUtcAnchorMs(2026, 1, 6),
      finUtc: civilDateInZonaToUtcAnchorMs(2026, 1, 10),
    };
    const merged = mergeClosedIntervals([i2, i1]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].inicioUtc, i1.inicioUtc);
    assert.equal(merged[0].finUtc, i2.finUtc);
  });
});

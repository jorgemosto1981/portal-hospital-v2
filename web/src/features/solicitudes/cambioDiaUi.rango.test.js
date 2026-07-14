import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rangoFechaDestinoCambioDia } from "./cambioDiaUi.js";

describe("rangoFechaDestinoCambioDia", () => {
  it("es exactamente ±10 corridos desde la ausencia", () => {
    const r = rangoFechaDestinoCambioDia("2026-07-16", "2026-07-16", 10);
    assert.equal(r.ok, true);
    assert.equal(r.min, "2026-07-06");
    assert.equal(r.max, "2026-07-26");
  });

  it("no aplana con hoy ni preaviso", () => {
    const r = rangoFechaDestinoCambioDia("2026-07-16", "2026-07-16", 10, {
      hoyYmd: "2026-07-14",
      permiteRetroactividad: false,
    });
    assert.equal(r.min, "2026-07-06");
    assert.equal(r.max, "2026-07-26");
  });
});

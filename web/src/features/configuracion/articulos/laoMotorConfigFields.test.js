import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MES_DIA_APERTURA_LAO,
  isMesDiaAperturaLaoValido,
  normalizeMesDiaAperturaLao,
} from "./laoMotorConfigFields.js";

describe("laoMotorConfigFields", () => {
  it("valida MM-DD", () => {
    assert.equal(isMesDiaAperturaLaoValido("07-01"), true);
    assert.equal(isMesDiaAperturaLaoValido("13-01"), false);
    assert.equal(isMesDiaAperturaLaoValido("07-32"), false);
  });

  it("normaliza o devuelve null", () => {
    assert.equal(normalizeMesDiaAperturaLao(" 07-01 "), DEFAULT_MES_DIA_APERTURA_LAO);
    assert.equal(normalizeMesDiaAperturaLao(""), null);
    assert.equal(normalizeMesDiaAperturaLao("invalid"), null);
  });
});

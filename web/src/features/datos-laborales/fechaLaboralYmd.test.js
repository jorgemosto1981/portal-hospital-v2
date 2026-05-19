import { describe, expect, it } from "vitest";

import {
  hlcFechaDesdeYmd,
  vigenteEnFechaInclusivaYmd,
  ymdDesdeValorLaboral,
} from "../../../../shared/utils/fechaLaboralYmd.js";

describe("fechaLaboralYmd", () => {
  it("conserva YYYY-MM-DD civil sin desplazar por ISO UTC", () => {
    expect(ymdDesdeValorLaboral("2022-05-31")).toBe("2022-05-31");
    expect(ymdDesdeValorLaboral("2022-05-31T03:00:00.000Z")).toBe("2022-05-31");
    expect(ymdDesdeValorLaboral("2022-06-01T02:59:59.999Z")).toBe("2022-05-31");
  });

  it("vigencia inclusiva en extremos del rango", () => {
    expect(vigenteEnFechaInclusivaYmd("2022-05-31", "2022-06-30", "2022-05-31")).toBe(true);
    expect(vigenteEnFechaInclusivaYmd("2022-05-31", "2022-06-30", "2022-06-30")).toBe(true);
    expect(vigenteEnFechaInclusivaYmd("2022-05-31", "2022-06-30", "2022-05-30")).toBe(false);
    expect(vigenteEnFechaInclusivaYmd("2022-05-31", "2022-06-30", "2022-07-01")).toBe(false);
  });

  it("hlcFechaDesdeYmd unifica alias de campo", () => {
    expect(hlcFechaDesdeYmd({ fecha_desde: "2022-05-31" })).toBe("2022-05-31");
    expect(hlcFechaDesdeYmd({ fecha_inicio: "2022-05-31" })).toBe("2022-05-31");
  });
});

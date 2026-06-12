import { describe, expect, it } from "vitest";

import { instanteMarcaInstitucionalMs } from "../../../../../shared/utils/fichadasValidacionMarcas.js";
import {
  diaMesKeyDesdeFechaYmd,
  evaluarCercaniaCargaManual,
  marcasPayloadDesdeFichadasReales,
  normalizarHoraHmInput,
} from "./fichadasCargaManualUtils.js";

describe("fichadasCargaManualUtils", () => {
  it("diaMesKeyDesdeFechaYmd", () => {
    expect(diaMesKeyDesdeFechaYmd("2026-06-12")).toBe("12");
  });

  it("normalizarHoraHmInput", () => {
    expect(normalizarHoraHmInput("630")).toBe("06:30");
    expect(normalizarHoraHmInput("06:05")).toBe("06:05");
  });

  it("marcasPayloadDesdeFichadasReales", () => {
    const p = marcasPayloadDesdeFichadasReales([{ ingreso: "06:05", egreso: "14:00" }]);
    expect(p).toEqual([{ hora_hm: "06:05" }, { hora_hm: "14:00" }]);
  });

  it("evaluarCercania detecta <2min", () => {
    const r = evaluarCercaniaCargaManual({
      fecha_ymd: "2026-06-12",
      ingreso: "06:06",
      egreso: "",
      existentesVis: [
        {
          fecha_ymd: "2026-06-12",
          hora_hm: "06:05",
          instante_ms: instanteMarcaInstitucionalMs("2026-06-12", "06:05"),
        },
      ],
      colaSesion: [],
      umbralMinutos: 2,
    });
    expect(r.tieneCercania).toBe(true);
  });
});

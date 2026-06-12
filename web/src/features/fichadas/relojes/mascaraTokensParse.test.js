import { describe, expect, it } from "vitest";

import { extraerCamposSegunMascara } from "./mascaraTokensParse.js";

describe("extraerCamposSegunMascara", () => {
  it("parsea máscara default con espacios", () => {
    const r = extraerCamposSegunMascara("00123 13/06/26 06:05 001 01", "TTTTT DD/MM/YY HH:MM RRR CC");
    expect(r.ok).toBe(true);
    expect(r.campos.numero_tarjeta).toBe("00123");
    expect(r.campos.fecha_ymd).toBe("2026-06-13");
    expect(r.campos.hora_hm).toBe("06:05");
    expect(r.campos.numero_reloj).toBe("001");
    expect(r.campos.codigo_funcion).toBe("01");
  });

  it("parsea línea compacta", () => {
    const r = extraerCamposSegunMascara("998231206261430001", "TTTTTDDMMYYHHMMRRR");
    expect(r.ok).toBe(true);
    expect(r.campos.numero_tarjeta).toBe("99823");
    expect(r.campos.fecha_ymd).toBe("2026-06-12");
    expect(r.campos.hora_hm).toBe("14:30");
    expect(r.campos.numero_reloj).toBe("001");
  });

  it("detecta separador incorrecto", () => {
    const r = extraerCamposSegunMascara("12543;12/06/26", "TTTTT,DD/MM/YY,HH:MM,CC");
    expect(r.ok).toBe(false);
    expect(r.errores.length).toBeGreaterThan(0);
  });
});

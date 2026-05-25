import { describe, expect, it } from "vitest";

import { buildCheckinCierreAdvertencias } from "./buildCheckinCierreAdvertencias.js";
import { collectPendientesPatronB, collectPendientesPatronC } from "./collectPendientesPatronBC.js";
import { parseSaldosCheckinPrecarga } from "./parseSaldosCheckinPrecarga.js";
import { resolvePatronSaldo, PATRON_SALDO_B, PATRON_SALDO_C } from "./resolvePatronSaldo.js";
import { validateCheckinEstandar } from "./validateCheckinEstandar.js";
import { validateCheckinPatronC } from "./validateCheckinPatronC.js";
import { evalAltaOnboardingPasos } from "../altaOnboarding/evalAltaOnboardingPasos.js";

describe("resolvePatronSaldo", () => {
  it("resuelve B con reinicio cíclico", () => {
    expect(resolvePatronSaldo("cfg_rcc_anual", "cfg_os_interno", false)).toBe(PATRON_SALDO_B);
  });

  it("resuelve C con origen externo", () => {
    expect(resolvePatronSaldo("cfg_rcc_nunca", "cfg_os_externo_informado", false)).toBe(PATRON_SALDO_C);
  });
});

describe("validateCheckinEstandar", () => {
  it("rechaza decimales en días usados", () => {
    const r = validateCheckinEstandar({
      anioCiclo: 2026,
      diasConsumidosPrevios: "1.5",
      cupoDiasPorCiclo: 10,
      anioA: 2026,
    });
    expect(r.ok).toBe(false);
  });

  it("acepta entero dentro del cupo", () => {
    const r = validateCheckinEstandar({
      anioCiclo: 2026,
      diasConsumidosPrevios: "3",
      cupoDiasPorCiclo: 10,
      anioA: 2026,
    });
    expect(r.ok).toBe(true);
    expect(r.disponibleInicial).toBe(7);
  });
});

describe("validateCheckinPatronC", () => {
  it("acepta saldo negativo", () => {
    expect(validateCheckinPatronC("-2").ok).toBe(true);
  });
});

describe("parseSaldosCheckinPrecarga", () => {
  it("separa LAO, B del año A y C global", () => {
    const artLao = "art_01HZZZZZZZZZZZZZZZZZZZZZZ";
    const artB = "art_02HZZZZZZZZZZZZZZZZZZZZZZ";
    const artC = "art_03HZZZZZZZZZZZZZZZZZZZZZZ";
    const parsed = parseSaldosCheckinPrecarga({
      anioA: 2026,
      laoArticuloId: artLao,
      saldoDocs: [
        {
          bolsas: {
            [`bol_${artLao}_2024`]: {
              articulo_id: artLao,
              anio_origen: 2024,
              cantidad_inicial: 5,
              consumido: 0,
              disponible: 5,
            },
            [`bol_${artB}_2026`]: {
              articulo_id: artB,
              anio_origen: 2026,
              consumido: 2,
              disponible: 8,
            },
            [`bol_${artC}_global`]: {
              articulo_id: artC,
              bolsa_id: `bol_${artC}_global`,
              anio_origen: 0,
              disponible: 12,
            },
          },
        },
      ],
    });
    expect(parsed.filasLao.some((f) => f.anio_origen === "2024")).toBe(true);
    expect(parsed.diasPorArticuloB[artB]).toBe("2");
    expect(parsed.saldosPorArticuloC[artC]).toBe("12");
  });
});

describe("buildCheckinCierreAdvertencias", () => {
  it("incluye advertencia de cierre administrativo", () => {
    const adv = buildCheckinCierreAdvertencias({
      esNuevoCheckin: true,
      hlcConfirmadas: true,
      lineasResumen: [{ tipo: "meta", texto: "x" }],
      tieneBolsasFirestore: false,
    });
    expect(adv.some((a) => a.id === "cierre-admin")).toBe(true);
  });
});

describe("collectPendientesPatronBC", () => {
  it("arma items B válidos", () => {
    const r = collectPendientesPatronB({
      articulosB: [{ id: "art_01HZZZZZZZZZZZZZZZZZZZZZZ", codigo: "X", cupoDiasPorCiclo: 10, versionId: "ver_01" }],
      articulos: [],
      diasPorArticuloB: { art_01HZZZZZZZZZZZZZZZZZZZZZZ: "2" },
      anioA: 2026,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items).toHaveLength(1);
  });
});

describe("evalAltaOnboardingPasos", () => {
  it("bloquea check-in sin HLc", () => {
    const { estado } = evalAltaOnboardingPasos(
      { checkin_saldos_portal_en: null },
      { tieneCuenta: true, hlcOperativos: 0 },
    );
    expect(estado.checkin).toBe("bloqueado");
  });

  it("marca check-in ok con cierre global", () => {
    const { estado } = evalAltaOnboardingPasos(
      { checkin_saldos_portal_en: "2026-01-01" },
      { tieneCuenta: true, hlcOperativos: 1 },
    );
    expect(estado.checkin).toBe("ok");
  });
});

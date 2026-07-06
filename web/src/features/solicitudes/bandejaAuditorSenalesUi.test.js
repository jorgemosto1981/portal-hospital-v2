import { describe, expect, it } from "vitest";

import {
  calcularPlazoProvisorioSenal,
  compararBandejaAuditorProvisoriasPorUrgencia,
  formatearCountdownPlazo,
  parseInstanteFirestoreMs,
  puntajeUrgenciaProvisorio,
  resolverBadgesBandejaAuditor,
} from "../../../../shared/utils/bandejaAuditorSenalesCore.js";
import { clasesBadgeSenalAuditor, clasesCountdownSenalAuditor } from "./bandejaAuditorSenalesUi.js";

describe("bandejaAuditorSenalesCore", () => {
  const ahora = Date.parse("2026-08-28T12:00:00.000Z");

  it("parseInstanteFirestoreMs acepta ISO y _seconds", () => {
    expect(parseInstanteFirestoreMs("2026-08-30T03:00:00.000Z")).toBe(Date.parse("2026-08-30T03:00:00.000Z"));
    expect(parseInstanteFirestoreMs({ _seconds: 1_756_531_200 })).toBe(1_756_531_200_000);
  });

  it("formatea countdown restante y vencido", () => {
    expect(formatearCountdownPlazo(2 * 3600 * 1000)).toBe("Quedan 2 h");
    expect(formatearCountdownPlazo(-90 * 60 * 1000)).toBe("Vencida hace 1 h 30 min");
  });

  it("completa no aplica plazo provisorio", () => {
    const r = calcularPlazoProvisorioSenal({ es_licencia_incompleta: false }, ahora);
    expect(r.aplica).toBe(false);
    expect(r.nivel).toBe("na");
  });

  it("provisoria urgente (<24h)", () => {
    const venc = new Date(ahora + 5 * 3600 * 1000).toISOString();
    const r = calcularPlazoProvisorioSenal(
      { es_licencia_incompleta: true, vencimiento_plazo_certificado: venc },
      ahora,
    );
    expect(r.nivel).toBe("urgente");
    expect(r.texto_countdown).toBe("Quedan 5 h");
  });

  it("provisoria vencida", () => {
    const venc = new Date(ahora - 3600 * 1000).toISOString();
    const r = calcularPlazoProvisorioSenal(
      { es_licencia_incompleta: true, vencimiento_plazo_certificado: venc },
      ahora,
    );
    expect(r.vencida).toBe(true);
    expect(r.nivel).toBe("vencida");
  });

  it("badges: lista vs provisoria vs vencida", () => {
    const completa = resolverBadgesBandejaAuditor({ puede_clasificar: true, es_licencia_incompleta: false }, ahora);
    expect(completa.some((b) => b.id === "lista")).toBe(true);

    const prov = resolverBadgesBandejaAuditor(
      {
        es_licencia_incompleta: true,
        vencimiento_plazo_certificado: new Date(ahora + 48 * 3600 * 1000).toISOString(),
      },
      ahora,
    );
    expect(prov.some((b) => b.id === "provisoria")).toBe(true);

    const vencida = resolverBadgesBandejaAuditor(
      {
        es_licencia_incompleta: true,
        vencimiento_plazo_certificado: new Date(ahora - 1000).toISOString(),
      },
      ahora,
    );
    expect(vencida.some((b) => b.id === "vencida")).toBe(true);
  });

  it("ordena provisorias: vencida antes que holgada", () => {
    const ahora = Date.parse("2026-08-28T12:00:00.000Z");
    const vencida = {
      es_licencia_incompleta: true,
      vencimiento_plazo_certificado: new Date(ahora - 1000).toISOString(),
      fecha_desde: "2026-08-30",
      solicitud_id: "sol_B",
    };
    const holgada = {
      es_licencia_incompleta: true,
      vencimiento_plazo_certificado: new Date(ahora + 10 * 24 * 3600 * 1000).toISOString(),
      fecha_desde: "2026-08-29",
      solicitud_id: "sol_A",
    };
    expect(puntajeUrgenciaProvisorio(vencida, ahora)).toBeLessThan(puntajeUrgenciaProvisorio(holgada, ahora));
    expect(compararBandejaAuditorProvisoriasPorUrgencia(vencida, holgada, ahora)).toBeLessThan(0);
  });
});

describe("bandejaAuditorSenalesUi clases", () => {
  it("mapea variantes tailwind", () => {
    expect(clasesBadgeSenalAuditor("lista")).toContain("teal");
    expect(clasesCountdownSenalAuditor("vencida")).toContain("rose");
  });
});

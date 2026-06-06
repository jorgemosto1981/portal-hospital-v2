import { describe, expect, it } from "vitest";

import {
  CODIGO_PERIODO_CERRADO,
  CODIGO_VENTANA_MES_ANTERIOR,
  COPY_BADGE_SOLO_LECTURA_GSO,
  COPY_TARJETA_PERIODO_CERRADO_JEFE,
  COPY_TARJETA_PERIODO_CERRADO_RRHH,
  MOTIVO_PERIODO_CERRADO,
  MOTIVO_VENTANA_MES_ANTERIOR,
  copyDetalleSoloLecturaGso,
  copyTarjetaPeriodoCerrado,
  evaluarSoloLecturaCeldaGso,
  evaluarSoloLecturaVentanaGso,
  gsoPermiteEscritura,
  motivoDesdeCodigoGso,
  soloLecturaDesdeGsoEscrituraApi,
} from "./grillaGsoSoloLectura.js";

describe("grillaGsoSoloLectura US-8", () => {
  it("ventana M-1 → ASI-GSO-001", () => {
    const v = evaluarSoloLecturaVentanaGso("2026-05", { hoy: new Date(2026, 5, 15) });
    expect(v.solo_lectura).toBe(true);
    expect(v.codigo).toBe(CODIGO_VENTANA_MES_ANTERIOR);
    expect(v.motivo).toBe(MOTIVO_VENTANA_MES_ANTERIOR);
  });

  it("gsoPermiteEscritura bloquea período cerrado", () => {
    const g = gsoPermiteEscritura("2026-06", { periodoCerrado: true });
    expect(g.permite).toBe(false);
    expect(g.motivo).toBe(MOTIVO_PERIODO_CERRADO);
  });

  it("evaluarSoloLecturaCeldaGso — badge cuando hay datos", () => {
    const r = evaluarSoloLecturaCeldaGso({
      gsoPermiteEscritura: false,
      motivo: MOTIVO_VENTANA_MES_ANTERIOR,
      tieneDatos: true,
    });
    expect(r.activo).toBe(true);
    expect(r.tooltip).toBe(COPY_BADGE_SOLO_LECTURA_GSO);
  });

  it("evaluarSoloLecturaCeldaGso — sin badge si celda vacía", () => {
    expect(
      evaluarSoloLecturaCeldaGso({ gsoPermiteEscritura: false, tieneDatos: false }).activo,
    ).toBe(false);
  });

  it("soloLecturaDesdeGsoEscrituraApi", () => {
    const r = soloLecturaDesdeGsoEscrituraApi({
      escritura_habilitada: false,
      codigo: CODIGO_PERIODO_CERRADO,
    });
    expect(r.activo).toBe(true);
    expect(r.detalle).toBe(copyDetalleSoloLecturaGso(MOTIVO_PERIODO_CERRADO));
  });

  it("motivoDesdeCodigoGso", () => {
    expect(motivoDesdeCodigoGso(CODIGO_VENTANA_MES_ANTERIOR)).toBe(MOTIVO_VENTANA_MES_ANTERIOR);
    expect(motivoDesdeCodigoGso(CODIGO_PERIODO_CERRADO)).toBe(MOTIVO_PERIODO_CERRADO);
  });

  it("copyTarjetaPeriodoCerrado distingue RRHH", () => {
    expect(copyTarjetaPeriodoCerrado(false)).toBe(COPY_TARJETA_PERIODO_CERRADO_JEFE);
    expect(copyTarjetaPeriodoCerrado(true)).toBe(COPY_TARJETA_PERIODO_CERRADO_RRHH);
  });
});

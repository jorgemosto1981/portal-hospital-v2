/**
 * Plantilla genérica para onboarding: Lun–Vie 07:00–13:00; Sáb–Dom franco.
 * Siete elementos estrictos, `dia_semana` 1=Lunes … 7=Domingo (ISO semana).
 * @returns {Array<{ dia_semana: number, es_laborable: boolean, ingreso: string | null, egreso: string | null, horas: number }>}
 */
export function horarioPlantillaOnboardingGenerico() {
  return [1, 2, 3, 4, 5, 6, 7].map((dia_semana) => {
    const finDeSemana = dia_semana >= 6;
    return {
      dia_semana,
      es_laborable: !finDeSemana,
      ingreso: finDeSemana ? null : "07:00",
      egreso: finDeSemana ? null : "13:00",
      horas: finDeSemana ? 0 : 6,
    };
  });
}

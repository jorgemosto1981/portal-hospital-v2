/**
 * @param {{ anioCiclo: string|number, diasConsumidosPrevios: string|number, cupoDiasPorCiclo: number | null, anioA: number | null }}
 */
export function validateCheckinEstandar({ anioCiclo, diasConsumidosPrevios, cupoDiasPorCiclo, anioA }) {
  const ciclo = Number(anioCiclo);
  const usados = Number(diasConsumidosPrevios);
  const cupo = cupoDiasPorCiclo != null ? Number(cupoDiasPorCiclo) : null;

  if (!Number.isInteger(ciclo) || ciclo < 1900 || ciclo > 2100) {
    return { ok: false, message: "Indicá un año de ciclo válido." };
  }
  if (anioA != null && ciclo > anioA) {
    return {
      ok: false,
      message: `El año de ciclo no puede ser mayor que A (${anioA}). Usá A o un año anterior.`,
    };
  }
  const rawUsados = String(diasConsumidosPrevios ?? "").trim();
  if (rawUsados !== "" && !/^\d+$/.test(rawUsados)) {
    return { ok: false, message: "Los días ya usados deben ser un entero ≥ 0 (sin decimales)." };
  }
  if (!Number.isInteger(usados) || usados < 0) {
    return { ok: false, message: "Los días ya usados deben ser un entero ≥ 0." };
  }
  if (cupo != null && usados > cupo) {
    return {
      ok: false,
      message: `Los días usados (${usados}) no pueden superar el cupo del artículo (${cupo}).`,
    };
  }
  const disponibleInicial = cupo != null ? cupo - usados : null;
  return { ok: true, ciclo, usados, cupo, disponibleInicial };
}

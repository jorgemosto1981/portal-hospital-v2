/**
 * @param {{ filasLao: Array<{ anio_origen: string, dias_disponibles: string }>, filasB: Array<{ codigo: string, diasUsados: number, saldo: number, cupo: number | null }>, filasC: Array<{ codigo: string, saldo: number }>, anioA: number, personaLabel: string }}
 */
export function buildCheckinResumen({ filasLao, filasB, filasC, anioA, personaLabel }) {
  const lineas = [];
  if (personaLabel) lineas.push({ tipo: "meta", texto: personaLabel });
  if (anioA != null) lineas.push({ tipo: "meta", texto: `Año de corte portal (A): ${anioA}` });

  for (const f of filasLao) {
    lineas.push({
      tipo: "lao",
      texto: `LAO — año origen ${f.anio_origen}: ${f.dias_disponibles} días disponibles`,
    });
  }
  for (const f of filasB) {
    const cupoTxt = f.cupo != null ? ` (cupo ${f.cupo})` : "";
    lineas.push({
      tipo: "b",
      texto: `${f.codigo} — ciclo ${anioA}: usados ${f.diasUsados}, saldo inicial ${f.saldo}${cupoTxt}`,
    });
  }
  for (const f of filasC) {
    lineas.push({
      tipo: "c",
      texto: `${f.codigo} — saldo inicial ${f.saldo}`,
    });
  }

  return lineas;
}

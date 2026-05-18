import { buildBolsaKeyGlobal, mergeBolsasFromSaldoDocs } from "../../../../shared/utils/laoSaldosBolsa.js";

import { emptyCheckinFila } from "./checkinFilasUtils.js";

/**
 * @param {{ saldoDocs: Array<{ bolsas?: Record<string, object> }>, anioA: number, laoArticuloId: string }}
 */
export function parseSaldosCheckinPrecarga({ saldoDocs, anioA, laoArticuloId }) {
  const { bolsas } = mergeBolsasFromSaldoDocs(saldoDocs || []);
  const laoArt = String(laoArticuloId || "").trim();

  /** @type {Array<{ anio_origen: number, dias: number }>} */
  const laoRows = [];
  /** @type {Record<string, string>} */
  const diasB = {};
  /** @type {Record<string, string>} */
  const saldosC = {};

  for (const b of Object.values(bolsas)) {
    if (!b || typeof b !== "object") continue;
    const artId = String(b.articulo_id || "").trim();
    if (!/^art_/i.test(artId)) continue;

    const bolsaId = String(b.bolsa_id || "");
    const anioOrigen = Number(b.anio_origen);
    const consumido = Number(b.consumido) || 0;
    const disponible = Number(b.disponible);
    const cantidadInicial = Number(b.cantidad_inicial);

    const esGlobal =
      bolsaId === buildBolsaKeyGlobal(artId) ||
      bolsaId.endsWith("_global") ||
      anioOrigen === 0;

    if (esGlobal) {
      if (Number.isFinite(disponible)) {
        saldosC[artId] = String(disponible);
      }
      continue;
    }

    if (laoArt && artId === laoArt && Number.isInteger(anioOrigen) && anioOrigen < anioA) {
      let dias = cantidadInicial;
      if (!Number.isFinite(dias)) {
        dias = (Number.isFinite(disponible) ? disponible : 0) + consumido;
      }
      if (Number.isFinite(dias) && dias >= 0) {
        laoRows.push({ anio_origen: anioOrigen, dias });
      }
      continue;
    }

    if (Number.isInteger(anioOrigen) && anioOrigen === anioA) {
      diasB[artId] = String(consumido);
    }
  }

  laoRows.sort((a, b) => a.anio_origen - b.anio_origen);

  const filasLao =
    laoRows.length > 0
      ? laoRows.map((r) => ({
          ...emptyCheckinFila(),
          anio_origen: String(r.anio_origen),
          dias_disponibles: String(r.dias),
        }))
      : [emptyCheckinFila()];

  return { filasLao, diasPorArticuloB: diasB, saldosPorArticuloC: saldosC };
}

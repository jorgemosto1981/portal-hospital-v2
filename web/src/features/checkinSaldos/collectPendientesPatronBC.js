import { validateCheckinEstandar } from "./validateCheckinEstandar.js";
import { validateCheckinPatronC } from "./validateCheckinPatronC.js";

/**
 * @returns {{ ok: true, items: object[] } | { ok: false, message: string }}
 */
export function collectPendientesPatronB({ articulosB, articulos, diasPorArticuloB, anioA }) {
  const idsB = new Set([
    ...articulosB.map((a) => a.id),
    ...Object.keys(diasPorArticuloB).filter((id) => String(diasPorArticuloB[id] ?? "").trim() !== ""),
  ]);

  /** @type {object[]} */
  const items = [];
  for (const id of idsB) {
    const a = articulosB.find((x) => x.id === id) || articulos.find((x) => x.id === id);
    if (!a) continue;
    const meta = articulosB.find((x) => x.id === id);
    const raw = String(diasPorArticuloB[id] ?? "").trim();
    if (raw === "") continue;
    const v = validateCheckinEstandar({
      anioCiclo: String(anioA),
      diasConsumidosPrevios: raw,
      cupoDiasPorCiclo: meta?.cupoDiasPorCiclo ?? null,
      anioA,
    });
    if (!v.ok) {
      return { ok: false, message: `${a.codigo}: ${v.message}` };
    }
    items.push({
      articulo_id: a.id,
      anio_ciclo: anioA,
      dias_consumidos_previos: v.usados,
      ...(meta?.cupoDiasPorCiclo != null ? { cupo_dias_por_ciclo: meta.cupoDiasPorCiclo } : {}),
      ...(meta?.versionId ? { version_id: meta.versionId } : {}),
    });
  }

  if (!items.length) {
    return { ok: false, message: "Ingresá días usados en al menos un artículo patrón B." };
  }
  return { ok: true, items };
}

/**
 * @returns {{ ok: true, items: object[] } | { ok: false, message: string }}
 */
export function collectPendientesPatronC({ articulosC, articulos, saldosPorArticuloC }) {
  const idsC = new Set([
    ...articulosC.map((a) => a.id),
    ...Object.keys(saldosPorArticuloC).filter((id) => String(saldosPorArticuloC[id] ?? "").trim() !== ""),
  ]);

  /** @type {object[]} */
  const items = [];
  for (const id of idsC) {
    const a = articulosC.find((x) => x.id === id) || articulos.find((x) => x.id === id);
    if (!a) continue;
    const meta = articulosC.find((x) => x.id === id);
    const raw = String(saldosPorArticuloC[id] ?? "").trim();
    if (raw === "") continue;
    const vc = validateCheckinPatronC(raw);
    if (!vc.ok) {
      return { ok: false, message: `${a.codigo}: ${vc.message}` };
    }
    items.push({
      articulo_id: a.id,
      saldo_disponible_inicial: vc.saldo,
      ...(meta?.versionId ? { version_id: meta.versionId } : {}),
    });
  }

  if (!items.length) {
    return { ok: false, message: "Ingresá saldo en al menos un artículo patrón C." };
  }
  return { ok: true, items };
}

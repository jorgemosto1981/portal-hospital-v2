/**
 * Utilidades cliente — import TXT fichadas (Fase D).
 */

export const AVISO_DUPLICADO = "MARCA_DUPLICADA_PROBABLE";
export const AVISO_SIN_PERSONA = "MARCA_SIN_PERSONA";

/**
 * @param {Array<{ ok?: boolean, linea_raw?: string, numero_linea?: number }>} filas
 * @param {Record<number, boolean>} incluirPorLinea — true = incluir en apply
 */
export function contenidoTxtDesdeFilasPreview(filas, incluirPorLinea) {
  const lines = [];
  for (const f of filas) {
    if (!f.ok || !f.linea_raw) continue;
    const n = f.numero_linea;
    if (n != null && incluirPorLinea[n] === false) continue;
    lines.push(f.linea_raw);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {Array<{ numero_linea?: number, incluir_por_defecto?: boolean }>} filas
 */
export function mapaIncluirInicialDesdePreview(filas) {
  /** @type {Record<number, boolean>} */
  const map = {};
  for (const f of filas) {
    if (f.numero_linea == null) continue;
    map[f.numero_linea] = f.incluir_por_defecto !== false;
  }
  return map;
}

/**
 * @param {string[]} advertencias
 */
export function etiquetaAvisosFichada(advertencias) {
  const adv = Array.isArray(advertencias) ? advertencias : [];
  return adv
    .map((c) => {
      if (c === AVISO_DUPLICADO) return "Duplicado probable (<2 min)";
      if (c === AVISO_SIN_PERSONA) return "Sin enrolamiento";
      return c;
    })
    .join(" · ");
}

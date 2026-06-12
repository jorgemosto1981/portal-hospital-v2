/**
 * Simulación de extracción por máscara (playground ABM relojes).
 * Los literales de la máscara deben coincidir carácter a carácter con el TXT.
 */

/** @typedef {{ tipo: string; etiqueta: string; ejemplo: string }} TokenCatalogoRow */

export const CATALOGO_TOKENS_MASCARA = [
  { token: "TTTTT…", significado: "Número de tarjeta del agente", ejemplo: "09432" },
  { token: "DD/MM/YY", significado: "Fecha día/mes/año corto", ejemplo: "12/06/26" },
  { token: "DDMMYY", significado: "Fecha compacta (sin separadores)", ejemplo: "120626" },
  { token: "YYYY-MM-DD", significado: "Fecha ISO", ejemplo: "2026-06-12" },
  { token: "HH:MM", significado: "Hora:minutos", ejemplo: "14:30" },
  { token: "HHMM", significado: "Hora compacta (sin dos puntos)", ejemplo: "1430" },
  { token: "RRR…", significado: "Código del reloj / dispositivo", ejemplo: "001" },
  { token: "CC…", significado: "Código función (ingreso/egreso)", ejemplo: "01" },
];

const PATRONES_FIJOS = [
  { key: "YYYY-MM-DD", tipo: "fecha_iso" },
  { key: "DD/MM/YY", tipo: "fecha_dmy" },
  { key: "DDMMYY", tipo: "fecha_compacta" },
  { key: "HH:MM", tipo: "hora" },
  { key: "HHMM", tipo: "hora_compacta" },
];

/**
 * @param {string} mascara
 */
export function segmentarMascaraTokens(mascara) {
  const m = String(mascara || "");
  /** @type {Array<{ tipo: string; ancho?: number; literal?: string }>} */
  const segmentos = [];
  let i = 0;
  while (i < m.length) {
    let consumido = false;
    for (const p of PATRONES_FIJOS) {
      if (m.startsWith(p.key, i)) {
        segmentos.push({ tipo: p.tipo });
        i += p.key.length;
        consumido = true;
        break;
      }
    }
    if (consumido) continue;

    const ch = m[i];
    if (ch === "T") {
      let j = i;
      while (j < m.length && m[j] === "T") j += 1;
      segmentos.push({ tipo: "tarjeta", ancho: j - i });
      i = j;
      continue;
    }
    if (ch === "R") {
      let j = i;
      while (j < m.length && m[j] === "R") j += 1;
      segmentos.push({ tipo: "reloj", ancho: j - i });
      i = j;
      continue;
    }
    if (ch === "C") {
      let j = i;
      while (j < m.length && m[j] === "C") j += 1;
      segmentos.push({ tipo: "codigo_funcion", ancho: j - i });
      i = j;
      continue;
    }
    segmentos.push({ tipo: "literal", literal: ch });
    i += 1;
  }
  return segmentos;
}

function expandirAnioDosDigitos(yy) {
  if (yy >= 100) return yy;
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function normalizarFechaYmd(raw, tipo) {
  const s = String(raw || "").trim();
  if (tipo === "fecha_iso") {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (tipo === "fecha_dmy") {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return null;
    const y = expandirAnioDosDigitos(Number(m[3]));
    return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  if (tipo === "fecha_compacta") {
    const m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (!m) return null;
    const y = expandirAnioDosDigitos(Number(m[3]));
    return `${y}-${m[2]}-${m[1]}`;
  }
  return null;
}

/**
 * @param {string} raw
 * @param {string} tipo
 */
function normalizarHoraHm(raw, tipo) {
  const s = String(raw || "").trim();
  if (tipo === "hora") {
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  if (tipo === "hora_compacta") {
    const m = s.match(/^(\d{2})(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return null;
}

/**
 * @param {string} linea
 * @param {string} mascara
 */
export function extraerCamposSegunMascara(linea, mascara) {
  const raw = String(linea ?? "");
  const segmentos = segmentarMascaraTokens(mascara);
  let pos = 0;
  /** @type {Record<string, string>} */
  const campos = {};
  /** @type {string[]} */
  const errores = [];

  for (const seg of segmentos) {
    if (seg.tipo === "literal") {
      if (raw[pos] !== seg.literal) {
        errores.push(`Se esperaba «${seg.literal}» en posición ${pos + 1}.`);
        break;
      }
      pos += 1;
      continue;
    }

    if (seg.tipo === "tarjeta" || seg.tipo === "reloj" || seg.tipo === "codigo_funcion") {
      const trozo = raw.slice(pos, pos + (seg.ancho || 0));
      if (trozo.length < (seg.ancho || 0)) {
        errores.push(`Faltan caracteres para ${seg.tipo} (${seg.ancho} esperados).`);
        break;
      }
      pos += seg.ancho || 0;
      if (seg.tipo === "tarjeta") campos.numero_tarjeta = trozo.trim();
      if (seg.tipo === "reloj") campos.numero_reloj = trozo.trim();
      if (seg.tipo === "codigo_funcion") campos.codigo_funcion = trozo.trim();
      continue;
    }

    if (seg.tipo === "fecha_iso") {
      const trozo = raw.slice(pos, pos + 10);
      const ymd = normalizarFechaYmd(trozo, seg.tipo);
      if (!ymd) {
        errores.push("Fecha ISO inválida (YYYY-MM-DD).");
        break;
      }
      campos.fecha_ymd = ymd;
      campos.fecha_cruda = trozo;
      pos += 10;
      continue;
    }

    if (seg.tipo === "fecha_dmy") {
      let fin = pos;
      while (fin < raw.length && /[\d/]/.test(raw[fin])) fin += 1;
      const trozo = raw.slice(pos, fin);
      const ymd = normalizarFechaYmd(trozo, seg.tipo);
      if (!ymd) {
        errores.push("Fecha DD/MM/YY inválida.");
        break;
      }
      campos.fecha_ymd = ymd;
      campos.fecha_cruda = trozo;
      pos = fin;
      continue;
    }

    if (seg.tipo === "fecha_compacta") {
      const trozo = raw.slice(pos, pos + 6);
      const ymd = normalizarFechaYmd(trozo, seg.tipo);
      if (!ymd) {
        errores.push("Fecha DDMMYY inválida.");
        break;
      }
      campos.fecha_ymd = ymd;
      campos.fecha_cruda = trozo;
      pos += 6;
      continue;
    }

    if (seg.tipo === "hora") {
      let fin = pos;
      while (fin < raw.length && /[\d:]/.test(raw[fin])) fin += 1;
      const trozo = raw.slice(pos, fin);
      const hm = normalizarHoraHm(trozo, seg.tipo);
      if (!hm) {
        errores.push("Hora HH:MM inválida.");
        break;
      }
      campos.hora_hm = hm;
      campos.hora_cruda = trozo;
      pos = fin;
      continue;
    }

    if (seg.tipo === "hora_compacta") {
      const trozo = raw.slice(pos, pos + 4);
      const hm = normalizarHoraHm(trozo, seg.tipo);
      if (!hm) {
        errores.push("Hora HHMM inválida.");
        break;
      }
      campos.hora_hm = hm;
      campos.hora_cruda = trozo;
      pos += 4;
    }
  }

  if (!errores.length && pos < raw.length) {
    const resto = raw.slice(pos).trim();
    if (resto) errores.push(`Sobran ${resto.length} carácter(es) al final: «${resto}».`);
  }

  return {
    ok: errores.length === 0 && Boolean(campos.numero_tarjeta),
    campos,
    errores,
    consumido: pos,
  };
}

export const EJEMPLOS_MASCARA_RAPIDOS = [
  {
    id: "plano",
    label: "Plano compacto",
    linea: "998231206261430001",
    mascara: "TTTTTDDMMYYHHMMRRR",
  },
  {
    id: "espacios",
    label: "Con espacios (default)",
    linea: "00123 13/06/26 06:05 001 01",
    mascara: "TTTTT DD/MM/YY HH:MM RRR CC",
  },
  {
    id: "comas",
    label: "Con comas",
    linea: "12543,12/06/26,22:05,02",
    mascara: "TTTTT,DD/MM/YY,HH:MM,CC",
  },
];

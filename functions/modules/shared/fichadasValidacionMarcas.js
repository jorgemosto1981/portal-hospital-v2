"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const {
  civilDateInZonaToUtcAnchorMs,
  ZONA_HORARIA_INSTITUCIONAL,
} = require("./fechaInstitucionalBa");
const {
  MASCARA_RELOJ_DEFAULT,
  esMascaraParserV1,
  extraerCamposSegunMascara,
  normalizarMascaraTokens,
} = require("./mascaraTokensReloj");

/**
 * Parser TXT reloj + validación de marcas (Fase A).
 * Zona institucional fija; sin I/O Firestore.
 */





const DEFAULT_UMBRAL_DUPLICADO_MINUTOS = 2;
const CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE = "MARCA_DUPLICADA_PROBABLE";
const CODIGO_ERROR_LINEA_INVALIDA = "LINEA_INVALIDA";

/** Máscara v1: `TTTTT DD/MM/YY HH:MM RRR CC` (tokens separados por espacios). */
const REGEX_LINEA_MASCARA_V1 =
  /^(\S+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})\s+(\S+)\s+(\S+)\s*$/;

/**
 * @param {number} yy
 */
function expandirAnioDosDigitos(yy) {
  if (yy >= 100) return yy;
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

/**
 * @param {string} fechaToken DD/MM/YY o DD/MM/YYYY
 * @returns {{ fecha_ymd: string, year: number, month: number, day: number } | null}
 */
function parseFechaTokenReloj(fechaToken) {
  const m = String(fechaToken || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = expandirAnioDosDigitos(Number(m[3]));
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fecha_ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { fecha_ymd, year, month, day };
}

/**
 * @param {string} horaHm
 */
function parseHoraHmReloj(horaHm) {
  const m = String(horaHm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hora_hm: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, h, min };
}

/**
 * Instant UTC ms del marca en zona institucional (día civil + hora local).
 *
 * @param {string} fecha_ymd
 * @param {string} hora_hm
 */
function instanteMarcaInstitucionalMs(fecha_ymd, hora_hm) {
  const [ys, ms, ds] = String(fecha_ymd).split("-").map(Number);
  const hora = parseHoraHmReloj(hora_hm);
  if (!hora || !Number.isFinite(ys)) return null;
  const anchor = civilDateInZonaToUtcAnchorMs(ys, ms, ds, ZONA_HORARIA_INSTITUCIONAL);
  return anchor + (hora.h * 60 + hora.min) * 60 * 1000;
}

function parseLineaRelojMascaraV1Regex(linea, numero_linea, raw) {
  const m = raw.match(REGEX_LINEA_MASCARA_V1);
  if (!m) {
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: `Formato esperado: ${MASCARA_RELOJ_DEFAULT}`,
      numero_linea,
      linea_raw: raw,
    };
  }

  const numero_tarjeta = m[1].trim();
  const fecha = parseFechaTokenReloj(m[2]);
  const hora = parseHoraHmReloj(m[3]);
  if (!fecha || !hora) {
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: "Fecha u hora inválida",
      numero_linea,
      linea_raw: raw,
    };
  }

  const instante_ms = instanteMarcaInstitucionalMs(fecha.fecha_ymd, hora.hora_hm);
  if (instante_ms == null) {
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: "No se pudo normalizar instante institucional",
      numero_linea,
      linea_raw: raw,
    };
  }

  return {
    ok: true,
    numero_linea,
    linea_raw: raw,
    numero_tarjeta,
    fecha_ymd: fecha.fecha_ymd,
    hora_hm: hora.hora_hm,
    numero_reloj: m[4].trim(),
    codigo_dispositivo: m[5].trim(),
    instante_ms,
    zona_horaria: ZONA_HORARIA_INSTITUCIONAL,
  };
}

function parseLineaRelojConMascaraTokens(linea, numero_linea, raw, mascara_tokens) {
  const extraccion = extraerCamposSegunMascara(raw, mascara_tokens);
  if (!extraccion.ok) {
    const detalle = extraccion.errores[0] || "Línea no coincide con la máscara del reloj.";
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: detalle,
      numero_linea,
      linea_raw: raw,
    };
  }
  const c = extraccion.campos;
  const instante_ms = instanteMarcaInstitucionalMs(c.fecha_ymd, c.hora_hm);
  if (instante_ms == null) {
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: "No se pudo normalizar instante institucional",
      numero_linea,
      linea_raw: raw,
    };
  }
  return {
    ok: true,
    numero_linea,
    linea_raw: raw,
    numero_tarjeta: c.numero_tarjeta,
    fecha_ymd: c.fecha_ymd,
    hora_hm: c.hora_hm,
    numero_reloj: String(c.numero_reloj || "").trim(),
    codigo_dispositivo: String(c.codigo_funcion || "").trim(),
    instante_ms,
    zona_horaria: ZONA_HORARIA_INSTITUCIONAL,
  };
}

/**
 * @param {string} linea
 * @param {object} [opts]
 * @param {number} [opts.numero_linea]
 * @param {string} [opts.mascara_tokens]
 */
function parseLineaRelojBiometrico(linea, opts = {}) {
  const numero_linea = opts.numero_linea ?? null;
  const raw = String(linea ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      codigo: CODIGO_ERROR_LINEA_INVALIDA,
      mensaje: "Línea vacía",
      numero_linea,
      linea_raw: raw,
    };
  }

  const mascara = normalizarMascaraTokens(opts.mascara_tokens);
  if (esMascaraParserV1(mascara)) {
    return parseLineaRelojMascaraV1Regex(linea, numero_linea, raw);
  }
  return parseLineaRelojConMascaraTokens(linea, numero_linea, raw, mascara);
}

/**
 * @param {string} contenidoTxt
 * @param {object} [opts]
 * @param {string} [opts.mascara_tokens]
 */
function parseTxtRelojBiometrico(contenidoTxt, opts = {}) {
  const lineas = String(contenidoTxt ?? "").split(/\r?\n/);
  const parseOpts = { mascara_tokens: opts.mascara_tokens };
  /** @type {Array<ReturnType<typeof parseLineaRelojBiometrico>>} */
  const resultado = [];
  for (let i = 0; i < lineas.length; i += 1) {
    const trimmed = lineas[i].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    resultado.push(parseLineaRelojBiometrico(trimmed, { ...parseOpts, numero_linea: i + 1 }));
  }
  return resultado;
}

/**
 * Clave de agrupación para duplicados (pre-enrolamiento: tarjeta).
 *
 * @param {object} marca
 * @param {string} [marca.persona_id]
 * @param {string} [marca.numero_tarjeta]
 * @param {string} marca.fecha_ymd
 */
function claveAgenteDiaMarca(marca) {
  const agente =
    typeof marca.persona_id === "string" && marca.persona_id.trim()
      ? `per:${marca.persona_id.trim()}`
      : `tarj:${String(marca.numero_tarjeta || "").trim()}`;
  return `${agente}|${marca.fecha_ymd}`;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {number} umbralMinutos
 */
function marcasSonDuplicadoProbable(a, b, umbralMinutos = DEFAULT_UMBRAL_DUPLICADO_MINUTOS) {
  if (claveAgenteDiaMarca(a) !== claveAgenteDiaMarca(b)) return false;
  const umbralMs = Math.max(0, Number(umbralMinutos) || DEFAULT_UMBRAL_DUPLICADO_MINUTOS) * 60 * 1000;
  const da = Number(a.instante_ms);
  const db = Number(b.instante_ms);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) < umbralMs;
}

/**
 * Marca cada ítem parseado con `advertencias: string[]` si hay duplicado probable en el lote.
 *
 * @param {Array<object>} marcasOk — líneas con ok:true
 * @param {object} [opts]
 * @param {number} [opts.umbral_duplicado_minutos]
 */
function detectarDuplicadosProbablesEnLote(marcasOk, opts = {}) {
  const umbral = opts.umbral_duplicado_minutos ?? DEFAULT_UMBRAL_DUPLICADO_MINUTOS;
  const ordenadas = [...marcasOk].sort((a, b) => {
    const c = claveAgenteDiaMarca(a).localeCompare(claveAgenteDiaMarca(b));
    if (c !== 0) return c;
    return Number(a.instante_ms) - Number(b.instante_ms);
  });

  /** @type {Map<string, object>} */
  const ultimaPorClave = new Map();

  return ordenadas.map((marca) => {
    const advertencias = [];
    const clave = claveAgenteDiaMarca(marca);
    const prev = ultimaPorClave.get(clave);
    if (prev && marcasSonDuplicadoProbable(prev, marca, umbral)) {
      advertencias.push(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE);
    }
    ultimaPorClave.set(clave, marca);
    return { ...marca, advertencias };
  });
}

/**
 * Contrasta una marca candidata contra existentes (vis_* o cola manual).
 *
 * @param {object} candidata
 * @param {Array<object>} existentes
 * @param {object} [opts]
 */
function advertenciasCercaniaMarca(candidata, existentes, opts = {}) {
  const umbral = opts.umbral_duplicado_minutos ?? DEFAULT_UMBRAL_DUPLICADO_MINUTOS;
  const adv = [];
  for (const ex of existentes) {
    if (marcasSonDuplicadoProbable(ex, candidata, umbral)) {
      adv.push(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE);
      break;
    }
  }
  return adv;
}

/**
 * Map-reduce en memoria (§15.2A): agrupa marcas parseadas para un write por `vis_*`/mes.
 *
 * @template T
 * @param {T[]} marcas
 * @param {(marca: T) => string} obtenerClaveVis
 * @returns {Map<string, T[]>}
 */
function agruparMarcasPorClaveVis(marcas, obtenerClaveVis) {
  const map = new Map();
  for (const m of marcas) {
    const k = obtenerClaveVis(m);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return map;
}

/**
 * @param {string} fecha_ymd
 * @returns {string} `YYYY-MM`
 */
function periodoYmDesdeFechaYmd(fecha_ymd) {
  return String(fecha_ymd || "").slice(0, 7);
}

/**
 * Clave estándar import: `vis_id` o fallback persona+gdt+periodo.
 *
 * @param {object} marca
 * @param {object} [ctx]
 * @param {string} [ctx.vis_id]
 * @param {string} [ctx.persona_id]
 * @param {string} [ctx.grupo_trabajo_id]
 */
function claveVisImportMarca(marca, ctx = {}) {
  if (ctx.vis_id) return String(ctx.vis_id);
  const pid = ctx.persona_id || marca.persona_id;
  const gdt = ctx.grupo_trabajo_id || marca.grupo_trabajo_id;
  const ym = periodoYmDesdeFechaYmd(marca.fecha_ymd);
  if (pid && gdt && ym) return `${pid}|${gdt}|${ym}`;
  return "";
}

module.exports = { ZONA_HORARIA_INSTITUCIONAL, MASCARA_RELOJ_DEFAULT, normalizarMascaraTokens, esMascaraParserV1, extraerCamposSegunMascara, DEFAULT_UMBRAL_DUPLICADO_MINUTOS, CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE, CODIGO_ERROR_LINEA_INVALIDA, parseFechaTokenReloj, parseHoraHmReloj, instanteMarcaInstitucionalMs, parseLineaRelojBiometrico, parseTxtRelojBiometrico, claveAgenteDiaMarca, marcasSonDuplicadoProbable, detectarDuplicadosProbablesEnLote, advertenciasCercaniaMarca, agruparMarcasPorClaveVis, periodoYmDesdeFechaYmd, claveVisImportMarca };

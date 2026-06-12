import {
  advertenciasCercaniaMarca,
  CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE,
  instanteMarcaInstitucionalMs,
} from "../../../../../shared/utils/fichadasValidacionMarcas.js";

export { CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE };

/** @param {string} fechaYmd */
export function diaMesKeyDesdeFechaYmd(fechaYmd) {
  const p = String(fechaYmd || "").trim().split("-");
  if (p.length !== 3) return "";
  return String(Number(p[2])).padStart(2, "0");
}

/**
 * @param {Array<Record<string, unknown>> | undefined} fichadas_reales
 */
export function marcasInstantesDesdeFichadasReales(fichadas_reales, fecha_ymd) {
  if (!Array.isArray(fichadas_reales)) return [];
  const out = [];
  for (const row of fichadas_reales) {
    if (!row || typeof row !== "object") continue;
    const ing = row.ingreso ? String(row.ingreso).trim() : "";
    const egr = row.egreso ? String(row.egreso).trim() : "";
    const hm = row.hora_hm ? String(row.hora_hm).trim() : "";
    if (ing) {
      out.push({
        fecha_ymd,
        hora_hm: ing,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, ing),
      });
    }
    if (egr) {
      out.push({
        fecha_ymd,
        hora_hm: egr,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, egr),
      });
    }
    if (hm && !ing && !egr) {
      out.push({
        fecha_ymd,
        hora_hm: hm,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, hm),
      });
    }
  }
  return out.filter((m) => Number.isFinite(m.instante_ms));
}

/**
 * Payload `marcas` para guardarCapaFichadaDia (solo hora_hm).
 * @param {Array<Record<string, unknown>> | undefined} fichadas_reales
 */
export function marcasPayloadDesdeFichadasReales(fichadas_reales) {
  const horas = [];
  if (!Array.isArray(fichadas_reales)) return horas;
  for (const row of fichadas_reales) {
    if (!row || typeof row !== "object") continue;
    if (row.ingreso) horas.push({ hora_hm: String(row.ingreso).trim() });
    if (row.egreso) horas.push({ hora_hm: String(row.egreso).trim() });
    if (row.hora_hm && !row.ingreso && !row.egreso) {
      horas.push({ hora_hm: String(row.hora_hm).trim() });
    }
  }
  return horas.filter((m) => m.hora_hm);
}

/**
 * @param {string} fecha_ymd
 * @param {string} ingreso
 * @param {string} egreso
 */
export function marcasCandidatasCargaManual(fecha_ymd, ingreso, egreso) {
  const marcas = [];
  const ing = String(ingreso || "").trim();
  const egr = String(egreso || "").trim();
  if (ing) {
    marcas.push({
      fecha_ymd,
      hora_hm: ing,
      instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, ing),
    });
  }
  if (egr) {
    marcas.push({
      fecha_ymd,
      hora_hm: egr,
      instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, egr),
    });
  }
  return marcas.filter((m) => Number.isFinite(m.instante_ms));
}

/**
 * @param {object} opts
 * @param {string} opts.fecha_ymd
 * @param {string} opts.ingreso
 * @param {string} opts.egreso
 * @param {Array<object>} opts.existentesVis
 * @param {Array<object>} opts.colaSesion
 * @param {number} opts.umbralMinutos
 */
export function evaluarCercaniaCargaManual(opts) {
  const candidatas = marcasCandidatasCargaManual(opts.fecha_ymd, opts.ingreso, opts.egreso);
  const existentes = [...(opts.existentesVis || []), ...(opts.colaSesion || [])];
  const adv = [];
  for (const c of candidatas) {
    adv.push(...advertenciasCercaniaMarca(c, existentes, { umbral_duplicado_minutos: opts.umbralMinutos }));
  }
  return {
    candidatas,
    tieneCercania: adv.includes(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE),
    advertencias: [...new Set(adv)],
  };
}

/** @param {string} raw */
export function normalizarHoraHmInput(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^\d{3,4}$/.test(t)) {
    const padded = t.padStart(4, "0");
    const h = Math.min(23, Number(padded.slice(0, -2)));
    const min = Math.min(59, Number(padded.slice(-2)));
    if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const m = t.match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!m) return t;
  const h = Math.min(23, Number(m[1]));
  const min = m[2] === "" ? 0 : Math.min(59, Number(m[2].padEnd(2, "0")));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function leerVersionCelda(celda) {
  const n = Number(celda?.fichadas_reales_version);
  return Number.isFinite(n) ? n : 0;
}

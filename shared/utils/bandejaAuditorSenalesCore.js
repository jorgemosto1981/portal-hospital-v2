/**
 * Señales §5.8 — bandeja auditor médica (RFC Caja Negra §5.8).
 * Lógica pura compartida web + functions.
 */

/** @typedef {"na"|"sin_plazo"|"ok"|"advertencia"|"urgente"|"vencida"} NivelPlazoProvisorio */
/** @typedef {"provisoria"|"lista"|"urgente"|"critico"|"advertencia"|"larga"} VarianteBadgeSenal */

const MS_HORA = 3600 * 1000;
const MS_URGENTE = 24 * MS_HORA;
const MS_ADVERTENCIA = 72 * MS_HORA;

/**
 * Normaliza Timestamp Firestore / ISO / epoch → ms UTC.
 * @param {unknown} raw
 * @returns {number}
 */
export function parseInstanteFirestoreMs(raw) {
  if (raw == null || raw === "") return NaN;
  if (typeof raw === "string") return Date.parse(raw);
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === "object" && raw !== null) {
    if (typeof raw.toDate === "function") {
      const d = raw.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : NaN;
    }
    const sec = Number(raw.seconds ?? raw._seconds);
    if (Number.isFinite(sec)) return sec * 1000;
  }
  return NaN;
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatearCountdownPlazo(ms) {
  if (!Number.isFinite(ms)) return "";
  const abs = Math.abs(ms);
  const dias = Math.floor(abs / (24 * MS_HORA));
  const horas = Math.floor((abs % (24 * MS_HORA)) / MS_HORA);
  const mins = Math.floor((abs % MS_HORA) / 60000);

  let frag = "";
  if (dias > 0) frag = dias === 1 ? "1 día" : `${dias} días`;
  else if (horas > 0) frag = mins > 0 ? `${horas} h ${mins} min` : `${horas} h`;
  else frag = `${Math.max(1, mins)} min`;

  return ms <= 0 ? `Vencida hace ${frag}` : `Quedan ${frag}`;
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @param {number} [ahoraMs]
 * @returns {{
 *   aplica: boolean,
 *   nivel: NivelPlazoProvisorio,
 *   ms_restantes: number | null,
 *   vencida: boolean,
 *   texto_countdown: string,
 * }}
 */
export function calcularPlazoProvisorioSenal(item, ahoraMs = Date.now()) {
  const incompleta = item?.es_licencia_incompleta === true;
  if (!incompleta) {
    return { aplica: false, nivel: "na", ms_restantes: null, vencida: false, texto_countdown: "" };
  }

  const vencMs = parseInstanteFirestoreMs(
    item?.vencimiento_plazo_certificado_iso ?? item?.vencimiento_plazo_certificado,
  );
  if (!Number.isFinite(vencMs)) {
    return {
      aplica: true,
      nivel: "sin_plazo",
      ms_restantes: null,
      vencida: false,
      texto_countdown: "Plazo certificado sin definir",
    };
  }

  const rest = vencMs - ahoraMs;
  if (rest <= 0) {
    return {
      aplica: true,
      nivel: "vencida",
      ms_restantes: rest,
      vencida: true,
      texto_countdown: formatearCountdownPlazo(rest),
    };
  }
  if (rest <= MS_URGENTE) {
    return {
      aplica: true,
      nivel: "urgente",
      ms_restantes: rest,
      vencida: false,
      texto_countdown: formatearCountdownPlazo(rest),
    };
  }
  if (rest <= MS_ADVERTENCIA) {
    return {
      aplica: true,
      nivel: "advertencia",
      ms_restantes: rest,
      vencida: false,
      texto_countdown: formatearCountdownPlazo(rest),
    };
  }
  return {
    aplica: true,
    nivel: "ok",
    ms_restantes: rest,
    vencida: false,
    texto_countdown: formatearCountdownPlazo(rest),
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @param {number} [ahoraMs]
 * @returns {Array<{ id: string, label: string, variant: VarianteBadgeSenal }>}
 */
export function resolverBadgesBandejaAuditor(item, ahoraMs = Date.now()) {
  /** @type {Array<{ id: string, label: string, variant: VarianteBadgeSenal }>} */
  const badges = [];
  const plazo = calcularPlazoProvisorioSenal(item, ahoraMs);

  if (item?.es_larga_episodio === true) {
    badges.push({ id: "larga", label: "Larga", variant: "larga" });
  }

  if (item?.es_licencia_incompleta === true) {
    if (plazo.vencida) badges.push({ id: "vencida", label: "Vencida", variant: "critico" });
    else if (plazo.nivel === "urgente") badges.push({ id: "urgente", label: "Urgente", variant: "urgente" });
    badges.push({ id: "provisoria", label: "Provisoria", variant: "provisoria" });
  } else if (item?.puede_clasificar === true) {
    badges.push({ id: "lista", label: "Lista", variant: "lista" });
  }

  if (item?.es_licencia_incompleta !== true && item?.tiene_certificado === false) {
    badges.push({ id: "sin_cert", label: "Sin certificado", variant: "advertencia" });
  }

  return badges;
}

/** Prioridad de sort: menor = más urgente. */
const RANK_VENCIDA = 0;
const RANK_SIN_PLAZO = 1;
const RANK_URGENTE_BASE = 10;
const RANK_ADVERTENCIA_BASE = 10_000;
const RANK_OK_BASE = 100_000;

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @param {number} [ahoraMs]
 * @returns {number}
 */
export function puntajeUrgenciaProvisorio(item, ahoraMs = Date.now()) {
  const plazo = calcularPlazoProvisorioSenal(item, ahoraMs);
  if (!plazo.aplica) return Number.MAX_SAFE_INTEGER;
  if (plazo.nivel === "vencida") return RANK_VENCIDA;
  if (plazo.nivel === "sin_plazo") return RANK_SIN_PLAZO;
  const rest = plazo.ms_restantes ?? Number.MAX_SAFE_INTEGER;
  if (plazo.nivel === "urgente") return RANK_URGENTE_BASE + rest;
  if (plazo.nivel === "advertencia") return RANK_ADVERTENCIA_BASE + rest;
  return RANK_OK_BASE + rest;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {number} [ahoraMs]
 * @returns {number}
 */
export function compararBandejaAuditorProvisoriasPorUrgencia(a, b, ahoraMs = Date.now()) {
  const pa = puntajeUrgenciaProvisorio(a, ahoraMs);
  const pb = puntajeUrgenciaProvisorio(b, ahoraMs);
  if (pa !== pb) return pa - pb;
  const fa = String(a.fecha_desde || "");
  const fb = String(b.fecha_desde || "");
  if (fa !== fb) return fa.localeCompare(fb);
  return String(a.solicitud_id || "").localeCompare(String(b.solicitud_id || ""));
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @param {number} [ahoraMs]
 */
export function resolverSenalPlazoBandejaAuditor(item, ahoraMs = Date.now()) {
  const plazo = calcularPlazoProvisorioSenal(item, ahoraMs);
  return {
    senal_plazo_nivel: plazo.nivel,
    senal_plazo_vencida: plazo.vencida,
    senal_plazo_ms_restantes: plazo.ms_restantes,
    senal_plazo_texto: plazo.texto_countdown,
    senal_plazo_urgencia_rank: puntajeUrgenciaProvisorio(item, ahoraMs),
  };
}

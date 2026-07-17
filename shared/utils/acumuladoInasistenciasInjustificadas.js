/**
 * Acumulado Art. 77-0 — puro (ventana móvil).
 * @see docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md
 */

/**
 * @param {string} ymd YYYY-MM-DD
 * @param {number} meses
 * @returns {string} YYYY-MM-DD
 */
export function restarMesesYmd(ymd, meses) {
  const s = String(ymd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const n = Math.max(0, Math.floor(Number(meses) || 0));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() - n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {Array<{ fecha_desde?: string, dias_solicitados?: unknown, estado_solicitud_id?: string, articulo_id?: string, codigo_grilla?: string }>} sols
 * @param {{
 *   articuloId77?: string,
 *   fechaHastaRef: string,
 *   ventanaMeses?: number,
 *   estadosOk?: Set<string>|string[],
 * }} opts
 */
export function sumarDiasInjustificadosVentana(sols, opts) {
  const fechaHastaRef = String(opts.fechaHastaRef || "").slice(0, 10);
  const ventana = opts.ventanaMeses == null ? 12 : Math.max(1, Math.floor(Number(opts.ventanaMeses)));
  const desdeMin = restarMesesYmd(fechaHastaRef, ventana);
  const artId = String(opts.articuloId77 || "").trim();
  const estados = opts.estadosOk
    ? opts.estadosOk instanceof Set
      ? opts.estadosOk
      : new Set(opts.estadosOk)
    : new Set(["cfg_esa_aprobada"]);

  let total = 0;
  const rows = Array.isArray(sols) ? sols : [];
  for (const s of rows) {
    if (!estados.has(String(s?.estado_solicitud_id || ""))) continue;
    const cod = String(s?.codigo_grilla || "").trim().toUpperCase();
    const aid = String(s?.articulo_id || "").trim();
    const es770 = cod === "77-0" || (artId && aid === artId);
    if (!es770) continue;
    const fd = String(s?.fecha_desde || "").slice(0, 10);
    if (fd < desdeMin || fd > fechaHastaRef) continue;
    const dias = Number(s?.dias_solicitados);
    total += Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 1;
  }
  return total;
}

/**
 * @param {number} diasAcumulados
 * @param {number} umbral
 */
export function umbralInjustificadasExcedido(diasAcumulados, umbral) {
  const d = Number(diasAcumulados);
  const u = Number(umbral);
  if (!Number.isFinite(d) || !Number.isFinite(u) || u <= 0) return false;
  return d > u;
}

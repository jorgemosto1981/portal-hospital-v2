/**
 * Filtros de fecha para auditoría de eventos en Datos personales (mes en curso por defecto).
 */

/** @returns {{ desde: string, hasta: string }} `YYYY-MM-DD` — mes calendario actual (zona local). */
export function mesEnCursoRangoLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m0 = now.getMonth();
  const desde = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m0 + 1, 0);
  const dd = String(last.getDate()).padStart(2, "0");
  const hasta = `${y}-${String(m0 + 1).padStart(2, "0")}-${dd}`;
  return { desde, hasta };
}

/** Valida `YYYY-MM-DD` como fecha civil local. */
export function parseYmd(s) {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [yy, mm, dd] = t.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return t;
}

/** Ordena `desde` / `hasta` si el usuario los invierte. */
export function normalizarDesdeHasta(desde, hasta) {
  const d = parseYmd(desde);
  const h = parseYmd(hasta);
  if (!d || !h) return null;
  if (d <= h) return { desde: d, hasta: h };
  return { desde: h, hasta: d };
}

function ymdFromDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Extrae día civil local del timestamp del evento (`ocurrido_en` / `creado_en`). */
export function eventoOcurridoYmdLocal(evt) {
  if (!evt || typeof evt !== "object") return null;
  const v = evt.ocurrido_en ?? evt.creado_en;
  if (v == null) return null;
  try {
    if (typeof v.toDate === "function") {
      return ymdFromDateLocal(v.toDate());
    }
    if (typeof v === "object" && typeof v._seconds === "number") {
      return ymdFromDateLocal(new Date(v._seconds * 1000));
    }
    if (typeof v === "string") {
      const ms = Date.parse(v);
      if (!Number.isNaN(ms)) return ymdFromDateLocal(new Date(ms));
    }
  } catch {
    return null;
  }
  return null;
}

/** Inclusivo en `desde` y `hasta` (comparación lexicográfica de `YYYY-MM-DD`). */
export function eventoEnRangoAuditoria(evt, desdeYmd, hastaYmd) {
  const ymd = eventoOcurridoYmdLocal(evt);
  if (!ymd) return false;
  return ymd >= desdeYmd && ymd <= hastaYmd;
}

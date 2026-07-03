/** @param {string} ymd */
export function formatYmdHistorialLm(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

/**
 * @param {"aprobada"|"rechazada"|"junta"|"otro"|string} categoria
 */
export function clasesBadgeEstadoHistorialLm(categoria) {
  const c = String(categoria || "").trim();
  if (c === "aprobada") return "bg-emerald-100 text-emerald-900";
  if (c === "rechazada") return "bg-rose-100 text-rose-900";
  if (c === "junta") return "bg-amber-100 text-amber-950";
  return "bg-slate-100 text-slate-700";
}

/**
 * @param {{ codigo_grilla?: string, articulo_label?: string }} row
 */
export function etiquetaArticuloHistorialLm(row) {
  const cod = String(row?.codigo_grilla || "").trim();
  const label = String(row?.articulo_label || "").trim();
  if (cod === "14") return "Art. 14 (LM)";
  if (cod === "16") return "Art. 16 (LM)";
  if (cod && label) return `${cod} — ${label}`;
  return cod || label || "Licencia médica";
}

/**
 * @param {{ fecha_desde?: string, fecha_hasta?: string }} row
 */
export function textoRangoHistorialLm(row) {
  const fd = formatYmdHistorialLm(String(row?.fecha_desde || ""));
  const fh = formatYmdHistorialLm(String(row?.fecha_hasta || ""));
  if (!fd && !fh) return "—";
  if (fd === fh || !fh) return fd;
  return `${fd} → ${fh}`;
}

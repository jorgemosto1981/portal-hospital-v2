export function parseIsoYmdToUtcMs(isoYmd) {
  const raw = String(isoYmd || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  const y = Number(match[1]);
  const mo = Number(match[2]) - 1;
  const d = Number(match[3]);
  const utc = Date.UTC(y, mo, d);
  const chk = new Date(utc);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo || chk.getUTCDate() !== d) return NaN;
  return utc;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDdMmAaaa(isoYmd) {
  const raw = String(isoYmd || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "—";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

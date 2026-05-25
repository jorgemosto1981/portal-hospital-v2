import { formatDateDdMmAaaa } from "./utils.js";

function toDateSafe(value) {
  const d = new Date(String(value || ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value) {
  const d = toDateSafe(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd} ${mm} ${yyyy} ${hh}:${min}`;
}

export function formatFechaVisible(value, fallback = "—") {
  return formatDateDdMmAaaa(value, fallback);
}

/** @param {string} periodo YYYY-MM */
export function fechaCorteFinMesDesdePeriodo(periodo) {
  const parts = String(periodo || "").split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return "";
  const ultimo = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

/** @param {string} periodo YYYY-MM */
export function anioMesDesdePeriodo(periodo) {
  const [anio, mes] = String(periodo || "").split("-").map((x) => Number(x));
  return { anio, mes };
}

/** Valida MM-DD para apertura temporada LAO (mes 01–12, día 01–31). */
export function isMesDiaAperturaLaoValido(value) {
  const raw = String(value ?? "").trim();
  const m = /^(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return false;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

/** @param {string | null | undefined} value */
export function normalizeMesDiaAperturaLao(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return isMesDiaAperturaLaoValido(raw) ? raw : null;
}

export const DEFAULT_MES_DIA_APERTURA_LAO = "07-01";
export const DEFAULT_TSE_MINIMO_DIAS_LAO = 180;

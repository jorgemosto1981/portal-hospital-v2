/** @param {string | null | undefined} raw */
export function parsePeriodoFocoUrl(raw) {
  const s = String(raw || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return null;
  return s;
}

export const GRILLA_FOCO_MODO_URL = {
  TITULAR: "titular",
};

/** @param {string | null | undefined} raw */
export function parseModoFocoUrl(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === GRILLA_FOCO_MODO_URL.TITULAR) return GRILLA_FOCO_MODO_URL.TITULAR;
  return null;
}

/**
 * @param {{ grupoId?: string; periodo?: string; modo?: string | null }} foco
 * @param {URLSearchParams} [base]
 */
export function buildGrillaFocoSearchParams(foco, base) {
  const next = new URLSearchParams(base || undefined);
  const grupoId = String(foco.grupoId || "").trim();
  const periodo = parsePeriodoFocoUrl(foco.periodo);
  const modo = parseModoFocoUrl(foco.modo);

  if (/^gdt_/i.test(grupoId)) {
    next.set("grupo_id", grupoId);
    next.delete("modo");
  } else {
    next.delete("grupo_id");
    if (modo === GRILLA_FOCO_MODO_URL.TITULAR) {
      next.set("modo", GRILLA_FOCO_MODO_URL.TITULAR);
    } else {
      next.delete("modo");
    }
  }

  if (periodo) next.set("periodo", periodo);
  else next.delete("periodo");
  return next;
}

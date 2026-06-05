/**
 * Horarios institucionales (America/Argentina/Buenos_Aires) — alineado a vis_* y régimen.
 */

const ZONA_INSTITUCIONAL = "America/Argentina/Buenos_Aires";

/**
 * HH:mm desde ISO UTC del backend (ymdHoraToIso → toISOString).
 * @param {unknown} iso
 */
export function horaDesdeIso(iso) {
  const s = String(iso || "").trim();
  if (!s) return "";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: ZONA_INSTITUCIONAL,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    const m = s.match(/T(\d{2}:\d{2})/);
    return m ? m[1] : "";
  }
}

/**
 * Horas efectivas de un tramo desde ISO materializado (prioridad sobre catálogo régimen).
 * Alineado a `computeResumenDesdeSegmentos` en capaTeoricaSegmentosCore.js.
 * @param {unknown} ingresoIso
 * @param {unknown} egresoIso
 */
export function horasDesdeIsoTramo(ingresoIso, egresoIso) {
  const t0 = new Date(String(ingresoIso || "")).getTime();
  const t1 = new Date(String(egresoIso || "")).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  return Math.round(((t1 - t0) / 3600000) * 100) / 100;
}

/**
 * @param {unknown} visDia
 * @param {{ capa_teorica?: { ingreso?: string; egreso?: string } } | null | undefined} turnoVis
 */
export function horarioOperativoDesdeVis(visDia, turnoVis) {
  const ing = String(
    (visDia && typeof visDia === "object" ? visDia.rda_ingreso : null)
    || turnoVis?.capa_teorica?.ingreso
    || "",
  ).trim();
  const egr = String(
    (visDia && typeof visDia === "object" ? visDia.rda_egreso : null)
    || turnoVis?.capa_teorica?.egreso
    || "",
  ).trim();
  if (ing && egr) return `${ing}–${egr}`;
  if (ing) return ing;
  return "";
}

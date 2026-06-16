/**
 * Límites institucionales (nominal + gracia) para motor de colisión teoría ↔ fichadas.
 */

import { civilDateInZonaToUtcAnchorMs } from "./fechaInstitucionalBa.js";

export const DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN = 30;

/** Fallback si `cfg_regimen_horario` aún no define el campo (materialización Fase F). */
export const DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN = 120;
export const DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN = 30;
export const DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT = 25;

/**
 * Resuelve umbral numérico: slice ya materializado → turno → régimen → default.
 *
 * @param {Record<string, unknown>} capaBase
 * @param {Record<string, unknown>|null|undefined} regimen
 * @param {Record<string, unknown>|null|undefined} turno
 * @param {string} campo
 * @param {number} fallback
 */
export function resolverUmbralCumplimientoMaterializado(capaBase, regimen, turno, campo, fallback) {
  const fromCapa = Number(capaBase?.[campo]);
  if (Number.isFinite(fromCapa) && fromCapa >= 0) return Math.trunc(fromCapa);
  const fromTurno = Number(turno?.[campo]);
  if (Number.isFinite(fromTurno) && fromTurno >= 0) return Math.trunc(fromTurno);
  const fromReg = Number(regimen?.[campo]);
  if (Number.isFinite(fromReg) && fromReg >= 0) return Math.trunc(fromReg);
  return fallback;
}

/**
 * @param {string} iso
 * @param {number} deltaMin — positivo suma, negativo resta
 */
export function isoMasMinutos(iso, deltaMin) {
  const ms = new Date(String(iso)).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + deltaMin * 60_000).toISOString();
}

/**
 * @param {object|null|undefined} regimen
 * @param {string|null|undefined} turnoIdRaw
 */
export function resolverTurnoRegimenParaTolerancias(regimen, turnoIdRaw) {
  const token = String(turnoIdRaw || "")
    .split("+")
    .map((s) => s.trim())
    .find(Boolean);
  const disp = Array.isArray(regimen?.turnos_disponibles) ? regimen.turnos_disponibles : [];
  if (token) {
    const hit = disp.find((t) => String(t.turno_id) === token);
    if (hit) return hit;
  }
  if (Array.isArray(regimen?.dias)) {
    for (const dia of regimen.dias) {
      if (dia?.turno && (!token || String(dia.turno.turno_id || "") === token)) {
        return dia.turno;
      }
    }
  }
  if (Array.isArray(regimen?.ciclo)) {
    for (const pos of regimen.ciclo) {
      if (pos?.turno && (!token || String(pos.turno.turno_id || "") === token)) {
        return pos.turno;
      }
    }
  }
  if (disp[0]) return disp[0];
  return { tolerancia_ingreso_min: 0, tolerancia_egreso_min: 0 };
}

/**
 * Enriquece slice `capa_teorica_por_grupo` con límites para calcularDeltasCumplimiento.
 *
 * @param {Record<string, unknown>} capa
 * @param {Record<string, unknown>|null|undefined} regimen
 */
export function enriquecerLimitesCumplimientoEnCapa(capa, regimen) {
  const base = capa && typeof capa === "object" ? { ...capa } : {};
  const horas = Number(base.horas_teoricas_totales);
  const carga_horaria_diaria_minutos = Number.isFinite(horas) && horas > 0 ? Math.round(horas * 60) : 0;
  const rawTol = Number(regimen?.tolerancia_debitohorario_minutos);
  const tolerancia_debitohorario_minutos = Number.isFinite(rawTol) && rawTol >= 0
    ? Math.trunc(rawTol)
    : DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN;

  const turnoId = base.turno_id || base.turno_compuesto_id;
  const turno = resolverTurnoRegimenParaTolerancias(regimen, turnoId);
  const tolIn = Number(turno?.tolerancia_ingreso_min) || 0;
  const tolOut = Number(turno?.tolerancia_egreso_min) || 0;

  const ingreso_nominal_iso = base.ingreso_teorico_final ? String(base.ingreso_teorico_final) : null;
  const egreso_nominal_iso = base.egreso_teorico_final ? String(base.egreso_teorico_final) : null;

  const ventana_ausencia_automatica_min = resolverUmbralCumplimientoMaterializado(
    base,
    regimen,
    turno,
    "ventana_ausencia_automatica_min",
    DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN,
  );
  const umbral_solape_fuera_turno_min = resolverUmbralCumplimientoMaterializado(
    base,
    regimen,
    turno,
    "umbral_solape_fuera_turno_min",
    DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN,
  );
  const umbral_solape_fuera_turno_pct = resolverUmbralCumplimientoMaterializado(
    base,
    regimen,
    turno,
    "umbral_solape_fuera_turno_pct",
    DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT,
  );

  return {
    ...base,
    carga_horaria_diaria_minutos,
    tolerancia_debitohorario_minutos,
    tolerancia_ingreso_dia_min: tolIn,
    tolerancia_egreso_dia_min: tolOut,
    ingreso_nominal_iso,
    ingreso_limite_con_gracia_iso: ingreso_nominal_iso ? isoMasMinutos(ingreso_nominal_iso, tolIn) : null,
    egreso_nominal_iso,
    egreso_limite_con_gracia_iso: egreso_nominal_iso ? isoMasMinutos(egreso_nominal_iso, -tolOut) : null,
    ventana_ausencia_automatica_min,
    umbral_solape_fuera_turno_min,
    umbral_solape_fuera_turno_pct,
  };
}

/**
 * @param {string} fechaYmd
 * @param {string} hhmm
 */
export function isoInstitucionalDesdeYmdHm(fechaYmd, hhmm) {
  const [y, mo, d] = String(fechaYmd).slice(0, 10).split("-").map(Number);
  const [h, mi] = String(hhmm || "00:00").split(":").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(h)) return null;
  const anchor = civilDateInZonaToUtcAnchorMs(y, mo, d);
  return new Date(anchor + (h * 60 + mi) * 60_000).toISOString();
}

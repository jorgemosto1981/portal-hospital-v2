"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { civilDateInZonaToUtcAnchorMs } = require("./fechaInstitucionalBa");

/**
 * Límites institucionales (nominal + gracia) para motor de colisión teoría ↔ fichadas.
 */


const DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN = 30;

/** Fallback si `cfg_regimen_horario` aún no define el campo (materialización Fase F). */
const DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN = 120;
const DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN = 30;
const DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT = 25;

/**
 * Resuelve umbral numérico: slice ya materializado → turno → régimen → default.
 *
 * @param {Record<string, unknown>} capaBase
 * @param {Record<string, unknown>|null|undefined} regimen
 * @param {Record<string, unknown>|null|undefined} turno
 * @param {string} campo
 * @param {number} fallback
 */
function resolverUmbralCumplimientoMaterializado(capaBase, regimen, turno, campo, fallback) {
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
function isoMasMinutos(iso, deltaMin) {
  const ms = new Date(String(iso)).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + deltaMin * 60_000).toISOString();
}

/**
 * @param {object|null|undefined} regimen
 * @param {string|null|undefined} turnoIdRaw
 */
function resolverTurnoRegimenParaTolerancias(regimen, turnoIdRaw) {
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
 * M+T+N continuo o M+N con huecos: ≥2 segmentos materializados → cumplimiento por tramo.
 * @param {Record<string, unknown>|null|undefined} capa
 */
function capaMaterializadaConSegmentosMultiples(capa) {
  const segmentos = Array.isArray(capa?.segmentos) ? capa.segmentos : [];
  return segmentos.length >= 2;
}

/**
 * Sobre teórico efectivo: prioriza segmentos materializados (override / cambio de turno).
 * @param {Record<string, unknown>} base
 */
function envelopeTeoricoDesdeCapa(base) {
  const capa = base && typeof base === "object" ? base : {};
  const segs = Array.isArray(capa.segmentos)
    ? capa.segmentos.filter((s) => s && s.ingreso_iso && s.egreso_iso)
    : [];
  if (segs.length > 0) {
    const sorted = [...segs].sort((a, b) =>
      String(a.ingreso_iso).localeCompare(String(b.ingreso_iso)),
    );
    const ingreso_teorico_final = sorted[0].ingreso_iso;
    const egreso_teorico_final = sorted[sorted.length - 1].egreso_iso;
    const turnoParaTolerancias =
      segs.length === 1
        ? (sorted[0].segmento_id || capa.turno_id || capa.turno_compuesto_id)
        : (capa.turno_compuesto_id || capa.turno_id);
    let horas = 0;
    for (const s of segs) {
      const t0 = new Date(s.ingreso_iso).getTime();
      const t1 = new Date(s.egreso_iso).getTime();
      if (t1 > t0) horas += (t1 - t0) / 3_600_000;
    }
    return {
      ingreso_teorico_final,
      egreso_teorico_final,
      turnoParaTolerancias,
      horas_desde_segmentos: horas > 0 ? horas : null,
    };
  }
  return {
    ingreso_teorico_final: capa.ingreso_teorico_final ?? null,
    egreso_teorico_final: capa.egreso_teorico_final ?? null,
    turnoParaTolerancias: capa.turno_id || capa.turno_compuesto_id,
    horas_desde_segmentos: null,
  };
}

/**
 * Enriquece slice `capa_teorica_por_grupo` con límites para calcularDeltasCumplimiento.
 *
 * @param {Record<string, unknown>} capa
 * @param {Record<string, unknown>|null|undefined} regimen
 */
function enriquecerLimitesCumplimientoEnCapa(capa, regimen) {
  const base = capa && typeof capa === "object" ? { ...capa } : {};
  const env = envelopeTeoricoDesdeCapa(base);
  const horas = Number(env.horas_desde_segmentos ?? base.horas_teoricas_totales);
  const carga_horaria_diaria_minutos = Number.isFinite(horas) && horas > 0 ? Math.round(horas * 60) : 0;
  const rawTol = Number(regimen?.tolerancia_debitohorario_minutos);
  const tolerancia_debitohorario_minutos = Number.isFinite(rawTol) && rawTol >= 0
    ? Math.trunc(rawTol)
    : DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN;

  const turno = resolverTurnoRegimenParaTolerancias(regimen, env.turnoParaTolerancias);
  const tolIn = Number(turno?.tolerancia_ingreso_min) || 0;
  const tolOut = Number(turno?.tolerancia_egreso_min) || 0;

  const ingreso_nominal_iso = env.ingreso_teorico_final ? String(env.ingreso_teorico_final) : null;
  const egreso_nominal_iso = env.egreso_teorico_final ? String(env.egreso_teorico_final) : null;

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
function isoInstitucionalDesdeYmdHm(fechaYmd, hhmm) {
  const [y, mo, d] = String(fechaYmd).slice(0, 10).split("-").map(Number);
  const [h, mi] = String(hhmm || "00:00").split(":").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(h)) return null;
  const anchor = civilDateInZonaToUtcAnchorMs(y, mo, d);
  return new Date(anchor + (h * 60 + mi) * 60_000).toISOString();
}

module.exports = { DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN, DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN, DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN, DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT, resolverUmbralCumplimientoMaterializado, isoMasMinutos, resolverTurnoRegimenParaTolerancias, capaMaterializadaConSegmentosMultiples, envelopeTeoricoDesdeCapa, enriquecerLimitesCumplimientoEnCapa, isoInstitucionalDesdeYmdHm };

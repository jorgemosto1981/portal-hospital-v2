/**
 * US-3 escenario A: comparar teoría vigente (rda_*) vs referencia al proyectar licencia.
 * Q9-4 B: también fichada que contradice teoría vigente (con licencia en celda).
 * Sin I/O — usable en web y functions.
 */

import { evaluarContradiccionFichadaTeoria } from "./grillaFichadaPresencia.js";

/** @param {unknown} raw */
function normalizarTipoDiaTeoria(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "no_laborable" || t === "no-laborable" || t === "nolaborable") return "no_laborable";
  if (t === "franco") return "franco";
  if (t === "guardia") return "guardia";
  if (t === "laborable") return "laborable";
  return t || null;
}

/**
 * Snapshot mínimo de capa 1 para referencia de licencia.
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {{ tipo_dia: string|null, rda_turno_id: string|null, es_franco: boolean }|null}
 */
export function extraerTeoriaRefDesdeCeldaVis(celda) {
  if (!celda || typeof celda !== "object") return null;
  const tipoRaw = normalizarTipoDiaTeoria(celda.tipo_dia);
  const esFranco = celda.es_franco === true || tipoRaw === "franco";
  const turnoId = String(celda.rda_turno_id || "").trim() || null;
  const ing = String(celda.rda_ingreso || "").trim();
  const egr = String(celda.rda_egreso || "").trim();
  const tieneJornada = Boolean(turnoId || ing || egr);

  let tipoDia = tipoRaw;
  if (!tipoDia && esFranco) tipoDia = "franco";
  if (!tipoDia && tieneJornada) tipoDia = "laborable";
  if (!tipoDia && !esFranco && !tieneJornada) return null;

  return {
    tipo_dia: tipoDia,
    rda_turno_id: turnoId,
    es_franco: esFranco,
  };
}

/**
 * @param {{ tipo_dia?: string|null, rda_turno_id?: string|null, es_franco?: boolean }|null|undefined} ref
 * @param {Record<string, unknown>|null|undefined} celdaVigente
 * @returns {{ desalineado: boolean; motivo?: string; tooltip?: string }}
 */
export function evaluarDesalineacionTeoriaLicencia(ref, celdaVigente) {
  if (!ref || typeof ref !== "object") {
    return { desalineado: false };
  }
  const vigente = extraerTeoriaRefDesdeCeldaVis(celdaVigente);
  if (!vigente) {
    return { desalineado: false };
  }

  const refTipo = normalizarTipoDiaTeoria(ref.tipo_dia);
  const vigTipo = normalizarTipoDiaTeoria(vigente.tipo_dia);
  const refFranco = ref.es_franco === true || refTipo === "franco";
  const vigFranco = vigente.es_franco === true || vigTipo === "franco";
  const refTurno = String(ref.rda_turno_id || "").trim();
  const vigTurno = String(vigente.rda_turno_id || "").trim();

  const cambioTipo = refTipo && vigTipo && refTipo !== vigTipo;
  const cambioFranco = refFranco !== vigFranco;
  const cambioTurno = refTurno !== vigTurno;

  if (!cambioTipo && !cambioFranco && !cambioTurno) {
    return { desalineado: false };
  }

  return {
    desalineado: true,
    motivo: "teoria_post_licencia",
    tooltip: "Teoría modificada post-licencia",
  };
}

/**
 * @param {unknown} eventos
 * @param {Record<string, unknown>|null|undefined} celdaVigente
 */
export function celdaTieneDesalineacionTeoria(eventos, celdaVigente) {
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return { desalineado: false };
  }

  for (const ev of eventos) {
    const r = evaluarDesalineacionTeoriaLicencia(
      ev && typeof ev === "object" ? ev.teoria_ref : null,
      celdaVigente,
    );
    if (r.desalineado) return r;
  }

  const fichada = evaluarContradiccionFichadaTeoria(celdaVigente);
  if (fichada.contradictorio) {
    return {
      desalineado: true,
      motivo: fichada.motivo,
      tooltip: fichada.tooltip,
    };
  }

  return { desalineado: false };
}

/**
 * Evalúa obsolescencia de teoría vs vis (licencias + contradicción fichada). Sin I/O.
 * @param {{ teoria_refs_licencia?: Array<Record<string, unknown>>; celdaVis?: Record<string, unknown>|null }} params
 */
export function evaluarCoherenciaTeoriaVisDia({ teoria_refs_licencia, celdaVis }) {
  const refs = Array.isArray(teoria_refs_licencia) ? teoria_refs_licencia : [];
  const pseudoEventos = refs
    .filter((r) => r && typeof r === "object")
    .map((teoria_ref) => ({ teoria_ref }));
  if (pseudoEventos.length > 0) {
    return celdaTieneDesalineacionTeoria(pseudoEventos, celdaVis);
  }
  const fichada = evaluarContradiccionFichadaTeoria(celdaVis);
  if (fichada.contradictorio) {
    return {
      desalineado: true,
      motivo: fichada.motivo,
      tooltip: fichada.tooltip,
    };
  }
  return { desalineado: false };
}

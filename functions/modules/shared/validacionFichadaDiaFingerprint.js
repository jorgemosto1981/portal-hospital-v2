"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Fingerprint estable para eval_estable (RFC Fase F §4.3).
 */

function stableStringify(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** Hash djb2 hex — invalidación de caché, no criptográfico. */
function fingerprintValidacionFichadaDia(parts) {
  const s = stableStringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return `fp_${(h >>> 0).toString(16)}`;
}

/**
 * @param {object} params
 */
function construirPartesFingerprintValidacionFichada({
  fecha_ymd,
  celda,
  capaTeoricaGrupo,
  licencia_cubre_dia,
  analitica_version,
}) {
  const capa = capaTeoricaGrupo && typeof capaTeoricaGrupo === "object" ? capaTeoricaGrupo : {};
  const c = celda && typeof celda === "object" ? celda : {};
  return {
    fecha_ymd: String(fecha_ymd || "").slice(0, 10),
    licencia_cubre_dia: licencia_cubre_dia === true,
    analitica_version: analitica_version ?? null,
    teoria: {
      fichadas_esperadas: c.fichadas_esperadas ?? capa.fichadas_esperadas ?? null,
      rda_turno_id: c.rda_turno_id ?? capa.turno_id ?? null,
      rda_ingreso: c.rda_ingreso ?? null,
      rda_egreso: c.rda_egreso ?? null,
      ventana_ausencia_automatica_min: capa.ventana_ausencia_automatica_min ?? null,
      umbral_solape_fuera_turno_min: capa.umbral_solape_fuera_turno_min ?? null,
      umbral_solape_fuera_turno_pct: capa.umbral_solape_fuera_turno_pct ?? null,
      ingreso_limite_con_gracia_iso: capa.ingreso_limite_con_gracia_iso ?? null,
      egreso_limite_con_gracia_iso: capa.egreso_limite_con_gracia_iso ?? null,
      analisis_carga_horaria_total_habilitado: capa.analisis_carga_horaria_total_habilitado !== false,
      tolerancia_debitohorario_minutos: capa.tolerancia_debitohorario_minutos ?? null,
    },
    fichadas_reales: c.fichadas_reales ?? c.fichadas ?? null,
    resuelto_rrhh: c.resuelto_rrhh === true,
    advertencias_abiertas: Array.isArray(c.advertencias_fichada_abiertas)
      ? c.advertencias_fichada_abiertas.filter(Boolean)
      : [],
  };
}

module.exports = { fingerprintValidacionFichadaDia, construirPartesFingerprintValidacionFichada };

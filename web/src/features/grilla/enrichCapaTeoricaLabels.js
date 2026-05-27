/**
 * Labels legibles para segmentos de capa_teorica (sin IDs técnicos en UI).
 * @param {Array<{ segmento_id: string; ingreso_iso?: string; egreso_iso?: string }>} segmentos
 * @param {Record<string, { etiqueta?: string; turno_id?: string }>} turnosPorId
 */
export function enrichCapaTeoricaLabels(segmentos, turnosPorId = {}) {
  return (segmentos || []).map((seg) => {
    const meta = turnosPorId[seg.segmento_id] || {};
    const etiqueta = meta.etiqueta || meta.turno_id || seg.segmento_id;
    const ingreso = seg.ingreso_iso ? seg.ingreso_iso.slice(11, 16) : "—";
    const egreso = seg.egreso_iso ? seg.egreso_iso.slice(11, 16) : "—";
    return {
      ...seg,
      segmento_label: etiqueta,
      horario_label: `${ingreso} – ${egreso}`,
      checkbox_label: `${etiqueta} (${ingreso}–${egreso})`,
    };
  });
}

/**
 * @param {object} regimenesIdx — map regimen_id → cfg_regimen_horario
 * @param {string} regimenId
 */
/**
 * Tramos que el titular aún ejecuta (cubribles); excluye tramos ya cedidos a otro ejecutante.
 * @param {Array<{ persona_titular_id?: string; persona_ejecutante_id?: string }>} segmentos
 * @param {string} personaTitularId
 */
export function filtrarSegmentosActivosTitular(segmentos, personaTitularId) {
  const pid = String(personaTitularId || "").trim();
  return (segmentos || []).filter(
    (s) => s.persona_titular_id === pid && s.persona_ejecutante_id === pid,
  );
}

export function turnosDisponiblesDesdeRegimen(regimenesIdx, regimenId) {
  const reg = regimenesIdx?.[regimenId];
  const out = {};
  for (const t of reg?.turnos_disponibles || []) {
    if (t.turno_id) out[t.turno_id] = t;
  }
  return out;
}

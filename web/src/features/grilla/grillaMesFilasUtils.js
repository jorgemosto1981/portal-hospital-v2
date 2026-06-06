/**
 * Normaliza filas de listarVistaGrillaMesPorGrupo (1 fila por tramo HLg).
 * @param {Array<Record<string, unknown>> | null | undefined} filas
 * @returns {Array<Record<string, unknown>>}
 */
export function filaKeyAg(ag) {
  const fid = String(ag?.fila_id || "").trim();
  if (fid) return fid;
  const pid = String(ag?.persona_id || "").trim();
  const hid = String(ag?.hlg_id || "").trim();
  return hid ? `${pid}__${hid}` : pid;
}

export function normalizarFilasGrillaEquipo(filas) {
  if (!Array.isArray(filas)) return [];
  return filas.map((fila) => {
    const personaId = String(fila.persona_id || "").trim();
    const hlgId = String(fila.hlg_id || "").trim();
    const filaId =
      String(fila.fila_id || "").trim() ||
      (personaId && hlgId ? `${personaId}__${hlgId}` : personaId);
    return {
      ...fila,
      fila_id: filaId,
      persona_id: personaId,
      hlg_id: hlgId || null,
      vigente_desde: fila.vigente_desde ? String(fila.vigente_desde).slice(0, 10) : null,
      vigente_hasta: fila.vigente_hasta ? String(fila.vigente_hasta).slice(0, 10) : null,
      regimen_horario_id: fila.regimen_horario_id || null,
      carga_horaria_semanal:
        fila.carga_horaria_semanal != null && Number.isFinite(Number(fila.carga_horaria_semanal))
          ? Number(fila.carga_horaria_semanal)
          : null,
      dias: fila.dias && typeof fila.dias === "object" ? fila.dias : {},
    };
  });
}

/**
 * Día fuera del tramo HLg de la fila (backend omite la clave en fila.dias).
 * @param {Record<string, unknown>} dias
 * @param {string} diaKey "01"…"31"
 */
export function diaFueraTramoHlg(dias, diaKey) {
  if (!dias || typeof dias !== "object") return true;
  return !Object.prototype.hasOwnProperty.call(dias, diaKey);
}

/**
 * Día fuera del tramo HLg acotado al mes (vigente_desde / vigente_hasta).
 * @param {string} ymd YYYY-MM-DD
 * @param {string|null|undefined} vigenteDesde
 * @param {string|null|undefined} vigenteHasta
 */
export function diaFueraVigenciaTramo(ymd, vigenteDesde, vigenteHasta) {
  const y = String(ymd || "").slice(0, 10);
  const vd = String(vigenteDesde || "").slice(0, 10);
  const vh = String(vigenteHasta || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y) || !vd || !vh) return false;
  if (y < vd) return true;
  if (y > vh) return true;
  return false;
}

/** @param {string|null|undefined} vigenteDesde @param {string|null|undefined} vigenteHasta */
export function formatearRangoTramoMes(vigenteDesde, vigenteHasta) {
  const vd = String(vigenteDesde || "").slice(0, 10);
  const vh = String(vigenteHasta || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vd) || !/^\d{4}-\d{2}-\d{2}$/.test(vh)) return null;
  const fmt = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `${fmt(vd)}–${fmt(vh)}`;
}

/** @param {number|null|undefined} carga */
export function etiquetaCargaTramo(carga) {
  if (carga == null || !Number.isFinite(Number(carga))) return null;
  const n = Number(carga);
  const h = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return `${h} hs`;
}

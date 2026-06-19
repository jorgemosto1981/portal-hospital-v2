/**
 * Régimen horario del cargo según tramo HLg vigente en una fecha (paridad grilla / materialización).
 * `personas_grupo` del contexto plan puede traer varias filas por persona (varios tramos en el mes).
 */

/**
 * @param {Array<Record<string, unknown>>|null|undefined} personasGrupo
 * @param {string} personaId
 */
export function filasHlgPersonaEnContextoGrupo(personasGrupo, personaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return [];
  return (Array.isArray(personasGrupo) ? personasGrupo : []).filter(
    (p) => String(p?.persona_id || "").trim() === pid,
  );
}

/**
 * Tramo HLg cuyo [vigente_desde, vigente_hasta] contiene la fecha (inclusive).
 * @param {Array<Record<string, unknown>>} filas
 * @param {string} fechaYmd
 */
export function tramoHlgVigenteEnFecha(filas, fechaYmd) {
  const f = String(fechaYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  const hits = (filas || []).filter((pg) => {
    const desde = String(pg.vigente_desde || pg.fecha_inicio || "").slice(0, 10);
    const hastaRaw = pg.vigente_hasta ?? pg.fecha_fin;
    const hasta = hastaRaw ? String(hastaRaw).slice(0, 10) : "";
    if (!desde || f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
  if (!hits.length) return null;
  hits.sort((a, b) =>
    String(b.vigente_desde || b.fecha_inicio || "").localeCompare(
      String(a.vigente_desde || a.fecha_inicio || ""),
      "es",
    ),
  );
  return hits[0];
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} personasGrupo
 * @param {string} personaId
 * @param {string} fechaYmd
 */
export function regimenHorarioIdParaFecha(personasGrupo, personaId, fechaYmd) {
  const tramo = tramoHlgVigenteEnFecha(
    filasHlgPersonaEnContextoGrupo(personasGrupo, personaId),
    fechaYmd,
  );
  return String(tramo?.regimen_horario_id || "").trim();
}

/**
 * Una entrada por persona con régimen efectivo en `fechaYmd` (para selects).
 * @param {Array<Record<string, unknown>>|null|undefined} personasGrupo
 * @param {string} fechaYmd
 * @param {string} [excluirPersonaId]
 */
export function personasConRegimenEnFecha(personasGrupo, fechaYmd, excluirPersonaId = "") {
  const excl = String(excluirPersonaId || "").trim();
  const byPersona = new Map();
  for (const row of Array.isArray(personasGrupo) ? personasGrupo : []) {
    const pid = String(row?.persona_id || "").trim();
    if (!pid || pid === excl) continue;
    const tramo = tramoHlgVigenteEnFecha(filasHlgPersonaEnContextoGrupo(personasGrupo, pid), fechaYmd);
    if (!tramo) continue;
    const reg = String(tramo.regimen_horario_id || "").trim();
    if (!reg) continue;
    if (!byPersona.has(pid)) {
      byPersona.set(pid, {
        ...row,
        regimen_horario_id: reg,
        hlg_id: tramo.hlg_id,
        vigente_desde: tramo.vigente_desde,
        vigente_hasta: tramo.vigente_hasta,
      });
    }
  }
  return [...byPersona.values()];
}

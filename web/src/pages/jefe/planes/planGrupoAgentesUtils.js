/**
 * Personas del contexto de plan: dedup por persona_id y orden alfabético.
 * @param {Array<{ persona_id?: string }>} personasGrupo
 * @param {Set<string>} [excluirPersonaIds]
 */
export function listarPersonasGrupoDisponibles(personasGrupo, excluirPersonaIds = new Set()) {
  const seen = new Set();
  const out = [];
  for (const p of personasGrupo || []) {
    const pid = String(p.persona_id || "").trim();
    if (!pid || excluirPersonaIds.has(pid) || seen.has(pid)) continue;
    seen.add(pid);
    out.push(p);
  }
  return out.sort((a, b) =>
    String(a.persona_label || a.persona_id).localeCompare(String(b.persona_label || b.persona_id), "es"),
  );
}

/**
 * @param {Array<{ persona_id?: string }>} personasGrupo
 * @param {string} personaId
 */
export function resolverPersonaGrupoPlan(personasGrupo, personaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return null;
  return (personasGrupo || []).find((p) => String(p.persona_id || "").trim() === pid) || null;
}

/**
 * Actor portal US-13 — formato único para grilla, planes y gestión turno.
 * `shell` fija esRrhh operativo; los claims solo aportan esJefeClaim e identidad.
 */

/** @typedef {"rrhh"|"jefe"} PortalFeatureShell */

export const PORTAL_FEATURE_SHELL = {
  RRHH: "rrhh",
  JEFE: "jefe",
};

/**
 * @param {PortalFeatureShell} shell
 * @returns {boolean}
 */
export function shellEsRrhhInstitucional(shell) {
  return shell === PORTAL_FEATURE_SHELL.RRHH;
}

/**
 * @param {{
 *   shell: PortalFeatureShell;
 *   personaId?: string;
 *   esJefeClaim?: boolean;
 *   nivelJerarquico?: number | null;
 * }} opts
 */
export function actorPortalTeoriaDesdeShell(opts) {
  const shell = opts?.shell === PORTAL_FEATURE_SHELL.RRHH
    ? PORTAL_FEATURE_SHELL.RRHH
    : PORTAL_FEATURE_SHELL.JEFE;
  const esRrhhShell = shellEsRrhhInstitucional(shell);
  const nj = opts?.nivelJerarquico;
  return {
    id: String(opts?.personaId || "").trim() || undefined,
    esJefe: opts?.esJefeClaim === true && !esRrhhShell,
    esRrhh: esRrhhShell,
    nivelJerarquico: nj == null || nj === "" ? 0 : Number(nj),
  };
}

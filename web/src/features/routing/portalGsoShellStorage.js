/** @typedef {"jefe"|"rrhh"} GsoShellId */

export const LAST_VISITED_GSO_SHELL_KEY = "last_visited_gso_shell";

/**
 * @param {string} pathname
 * @returns {GsoShellId | null}
 */
export function shellGsoDesdePathname(pathname) {
  const p = String(pathname || "");
  if (p.includes("/portal/jefe/") && (p.includes("grilla-operativa") || p.includes("planes-turno"))) {
    return "jefe";
  }
  if (p.includes("/portal/rrhh/") && (p.includes("grilla-operativa") || p.includes("planes-turno"))) {
    return "rrhh";
  }
  return null;
}

/**
 * @param {GsoShellId} shell
 * @param {Storage | null} [storage]
 */
export function writeLastVisitedGsoShell(shell, storage = defaultStorage()) {
  if (!storage) return;
  if (shell === "jefe" || shell === "rrhh") {
    storage.setItem(LAST_VISITED_GSO_SHELL_KEY, shell);
  }
}

/**
 * @param {Storage | null} [storage]
 * @returns {GsoShellId | null}
 */
export function readLastVisitedGsoShell(storage = defaultStorage()) {
  if (!storage) return null;
  const v = storage.getItem(LAST_VISITED_GSO_SHELL_KEY);
  return v === "jefe" || v === "rrhh" ? v : null;
}

function defaultStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

/**
 * Mensaje legible para errores en login (resolver DNI, sync claims).
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function loginCallableErrorMessage(err, fallback = "No se pudo completar el acceso.") {
  const code = err && typeof err === "object" && /** @type {{ code?: string }} */ (err).code;
  const c = typeof code === "string" ? code : "";
  if (
    c === "functions/unavailable" ||
    c === "functions/deadline-exceeded" ||
    c === "functions/internal" ||
    c === "auth/network-request-failed"
  ) {
    return "No hay conexión con el servidor (Firebase/Functions). Revisá internet, VPN o firewall y volvé a intentar.";
  }
  const msg = err && typeof err === "object" && /** @type {{ message?: string }} */ (err).message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return fallback;
}

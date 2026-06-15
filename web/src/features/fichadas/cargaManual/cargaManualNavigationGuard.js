/**
 * Guard global: bloquea navegación del portal mientras hay fichadas pendientes en cola.
 */
const MSG_DEFAULT =
  "Hay fichadas en cola sin enviar. Usá Enviar o quitá cada registro antes de salir.";

let estado = { activo: false, mensaje: MSG_DEFAULT };

/** @param {boolean} activo */
export function registrarBloqueoColaPendiente(activo, mensaje = MSG_DEFAULT) {
  estado = { activo: !!activo, mensaje: mensaje || MSG_DEFAULT };
}

/** @returns {{ activo: boolean, mensaje: string }} */
export function consultarBloqueoColaPendiente() {
  return { ...estado };
}

/**
 * @param {string} destinoPath
 * @returns {boolean} true si la navegación fue bloqueada
 */
export function intentarBloquearNavegacionPortal(destinoPath) {
  if (!estado.activo) return false;
  const destino = String(destinoPath || "").split("?")[0];
  if (!destino || destino === window.location.pathname) return false;
  return true;
}

export { MSG_DEFAULT as MSG_BLOQUEO_COLA_PENDIENTE };

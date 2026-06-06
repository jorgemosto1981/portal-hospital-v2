/**
 * Confirmación RRHH + callables rematerializar (F2.7).
 */

import {
  callRematerializarPostCalendario,
  callRematerializarPostRegimen,
} from "../../services/callables.js";

/**
 * @param {{ regimenId: string, regimenNombre?: string, onFeedback?: (msg: string) => void }} opts
 * @returns {Promise<boolean>} true si se ejecutó rematerialización
 */
export async function ofrecerRematerializarPostRegimen({ regimenId, regimenNombre, onFeedback }) {
  if (!regimenId) return false;
  const label = regimenNombre || regimenId;
  const ok = window.confirm(
    `¿Actualizar grillas del mes actual y siguiente para agentes con el régimen «${label}»? ` +
      "Puede tardar unos minutos.",
  );
  if (!ok) return false;
  try {
    const res = await callRematerializarPostRegimen({ regimen_id: regimenId });
    const data = res?.data || {};
    const fallos = Array.isArray(data.fallos) ? data.fallos.length : 0;
    const msg = data.ok
      ? `Grillas actualizadas (${data.periodos_procesados ?? 0} procesados, ${data.grupos ?? 0} grupos).`
      : `Materialización con ${fallos} fallo(s). Revisá consola o reintentá.`;
    onFeedback?.(msg);
    return data.ok === true;
  } catch (e) {
    onFeedback?.(e?.message || "Error al rematerializar por régimen.");
    return false;
  }
}

/**
 * @param {{ fechaYmd: string, onFeedback?: (msg: string) => void }} opts
 * @returns {Promise<boolean>}
 */
export async function ofrecerRematerializarPostCalendario({ fechaYmd, onFeedback }) {
  if (!fechaYmd) return false;
  const ok = window.confirm(
    `¿Actualizar capa teórica del día ${fechaYmd} en todos los grupos activos? ` +
      "Solo afecta regímenes fijo/rotativo.",
  );
  if (!ok) return false;
  try {
    const res = await callRematerializarPostCalendario({ fecha_ymd: fechaYmd });
    const data = res?.data || {};
    const fallos = Array.isArray(data.fallos) ? data.fallos.length : 0;
    const msg = data.ok
      ? `Calendario aplicado en grillas (${data.grupos ?? 0} grupos).`
      : `Materialización con ${fallos} fallo(s).`;
    onFeedback?.(msg);
    return data.ok === true;
  } catch (e) {
    onFeedback?.(e?.message || "Error al rematerializar por calendario.");
    return false;
  }
}

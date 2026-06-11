/**
 * T-06 paso 3 — copy y flags UI para guardrails US-13 (delega en teoriaPermisosGso vía grillaGestionTurnoCapabilities).
 */

import {
  actorTeoriaDesdeSesion,
  evaluarCapabilitiesGestionTurno,
} from "./grillaGestionTurnoCapabilities.js";
import {
  MOTIVOS_RECHAZO_TEORIA,
  copyMotivoRechazoTeoriaUsuario,
  esRrhhOperativo,
} from "./teoriaPermisosGso.js";

export const COPY_PERIODO_CERRADO_JEFE =
  "Acción restringida: Período en proceso de liquidación por RRHH.";

export const COPY_BADGE_RRHH_BYPASS =
  "Acción con privilegios de Dirección de RRHH (Bypass de Bloqueo)";

/**
 * @param {string | null | undefined} motivoRechazo
 * @param {boolean} [esJefe]
 */
export function copyGuardrailModificacionTeoria(motivoRechazo, esJefe = false) {
  if (motivoRechazo === MOTIVOS_RECHAZO_TEORIA.PERIODO_CERRADO && esJefe) {
    return COPY_PERIODO_CERRADO_JEFE;
  }
  if (motivoRechazo === MOTIVOS_RECHAZO_TEORIA.NO_ES_SUPERIOR_JERARQUICO) {
    return "Acción restringida: la jerarquía del agente no permite este override (G2).";
  }
  return copyMotivoRechazoTeoriaUsuario(motivoRechazo);
}

/**
 * @param {Parameters<typeof evaluarCapabilitiesGestionTurno>[0]} opts
 */
export function evaluarGuardrailsModificacionTeoria(opts) {
  const cap = evaluarCapabilitiesGestionTurno(opts);
  const actor = actorTeoriaDesdeSesion(opts?.usuarioActual || {});
  const esRrhh = esRrhhOperativo(actor);
  const esJefe = actor.esJefe === true && !esRrhh;
  const periodo = opts?.periodoGso || {};
  const periodoRestringido = periodo.cerrado === true || periodo.ventanaM1 === true;

  const puedeModificarTeoria = cap.puedeGestionarTurno;
  const mensajeBloqueo = puedeModificarTeoria
    ? null
    : copyGuardrailModificacionTeoria(cap.mensajeBloqueo, esJefe);

  const muestraBadgeBypassRrhh =
    esRrhh && periodoRestringido && puedeModificarTeoria;

  return {
    puedeModificarTeoria,
    requiereUrgencia: cap.requiereUrgencia,
    mensajeBloqueo,
    tituloTooltipBloqueo: mensajeBloqueo,
    muestraBadgeBypassRrhh,
    resultadoCrudo: cap.resultadoCrudo,
  };
}

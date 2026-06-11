/**
 * T-06 paso 3 — copy y flags UI para guardrails US-13 (delega en teoriaPermisosGso vía grillaGestionTurnoCapabilities).
 */

import {
  actorTeoriaDesdeSesion,
  evaluarCapabilitiesGestionTurno,
} from "./grillaGestionTurnoCapabilities.js";
import { CATALOGO_MOTIVOS_NOVEDAD_GSO } from "./grillaMotivosNovedadCatalogo.js";
import {
  MOTIVOS_RECHAZO_TEORIA,
  copyMotivoRechazoTeoriaUsuario,
  esRrhhOperativo,
} from "./teoriaPermisosGso.js";

export const COPY_PERIODO_CERRADO_JEFE =
  "Acción restringida: Período en proceso de liquidación por RRHH.";

export const COPY_BADGE_RRHH_BYPASS =
  "Acción con privilegios de Dirección de RRHH (Bypass de Bloqueo)";

export const COPY_OUTBOX_PERIODO_CERRADO =
  "No se pueden aplicar los cambios: el lote contiene días correspondientes a un período ya cerrado para liquidación.";

export const COPY_OUTBOX_CODIGO_EXCLUSIVO_RRHH =
  "No se pueden aplicar los cambios: el lote incluye justificaciones exclusivas de RRHH.";

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
/**
 * @typedef {Object} GuardrailNovedadContext
 * @property {boolean} puedeModificarTeoria
 * @property {boolean} esAuditoriaCentral — RRHH operativo
 */

/**
 * @param {{ puedeModificarTeoria?: boolean; esAuditoriaCentral?: boolean }} [partial]
 * @returns {GuardrailNovedadContext}
 */
export function buildGuardrailNovedadContext(partial = {}) {
  return {
    puedeModificarTeoria: partial.puedeModificarTeoria === true,
    esAuditoriaCentral: partial.esAuditoriaCentral === true,
  };
}

/**
 * @param {{ requiereAuditoriaCentral?: boolean } | null | undefined} novedad
 * @param {GuardrailNovedadContext} ctx
 */
export function puedeAsignarCodigoNovedad(novedad, ctx) {
  if (!novedad || !ctx) return false;
  if (!ctx.puedeModificarTeoria) return false;
  if (ctx.esAuditoriaCentral) return true;
  return novedad.requiereAuditoriaCentral !== true;
}

/**
 * @param {Array<{ id: string; codigo: string; label: string; requiereAuditoriaCentral?: boolean }>} catalogo
 * @param {GuardrailNovedadContext} ctx
 */
export function mapearOpcionesNovedadCatalogo(catalogo, ctx) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  return lista.map((nov) => {
    const codigoPermitido = puedeAsignarCodigoNovedad(nov, ctx);
    return {
      ...nov,
      codigoPermitido,
      disabled: !codigoPermitido,
    };
  });
}

/**
 * @param {Record<string, unknown>} op
 */
export function opTieneCodigoNovedadExclusivoRrhh(op) {
  const motivo = String(op?.motivo || "").trim();
  const match = motivo.match(/^\[([A-Z0-9_]+)\]/);
  if (!match) return false;
  const cod = match[1];
  return CATALOGO_MOTIVOS_NOVEDAD_GSO.some(
    (n) => n.codigo === cod && n.requiereAuditoriaCentral === true,
  );
}

/**
 * @param {{
 *   ops?: Array<Record<string, unknown>>;
 *   esAuditoriaCentral?: boolean;
 *   periodoRestringido?: boolean;
 *   puedeModificarTeoriaLote?: boolean;
 * }} opts
 */
export function evaluarGuardrailsAplicarOutbox(opts) {
  const ops = Array.isArray(opts?.ops) ? opts.ops : [];
  const esAuditoriaCentral = opts?.esAuditoriaCentral === true;
  const periodoRestringido = opts?.periodoRestringido === true;
  const puedeModificarTeoriaLote = opts?.puedeModificarTeoriaLote !== false;

  if (esAuditoriaCentral) {
    return {
      puedeAplicarBatch: true,
      mensajeBloqueo: null,
      muestraBadgeBypassRrhh: periodoRestringido,
    };
  }

  if (periodoRestringido || !puedeModificarTeoriaLote) {
    return {
      puedeAplicarBatch: false,
      mensajeBloqueo: COPY_OUTBOX_PERIODO_CERRADO,
      muestraBadgeBypassRrhh: false,
    };
  }

  if (ops.some(opTieneCodigoNovedadExclusivoRrhh)) {
    return {
      puedeAplicarBatch: false,
      mensajeBloqueo: COPY_OUTBOX_CODIGO_EXCLUSIVO_RRHH,
      muestraBadgeBypassRrhh: false,
    };
  }

  return {
    puedeAplicarBatch: true,
    mensajeBloqueo: null,
    muestraBadgeBypassRrhh: false,
  };
}

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

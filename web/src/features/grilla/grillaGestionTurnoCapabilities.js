/**
 * US-13 Fase B — capabilities gestión turno (portero UI → teoriaPermisosGso).
 */

import { MOTIVO_PERIODO_CERRADO, MOTIVO_VENTANA_MES_ANTERIOR } from "./grillaGsoSoloLectura.js";
import {
  CANALES_TEORIA,
  MOTIVOS_RECHAZO_TEORIA,
  actorTeoriaDesdePortal,
  evaluarPermisoTeoria,
  esRrhhOperativo,
} from "./teoriaPermisosGso.js";

export const GESTION_TURNO_ACCION = {
  INTERCAMBIO: "grilla.asistencia.intercambio",
  CAMBIO_PROPIO: "grilla.asistencia.cambio_propio",
  HORAS_ADICIONALES: "grilla.asistencia.horas_adicionales",
  APLICAR_BATCH: "grilla.asistencia.aplicar_batch",
};

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseNivelJerarquico(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} filas
 * @param {string} personaId
 * @param {string} [filaId]
 */
export function resolverNivelJerarquicoEnFilas(filas, personaId, filaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return null;
  const fid = String(filaId || "").trim();
  const lista = Array.isArray(filas) ? filas : [];
  const candidatas = fid
    ? lista.filter((f) => String(f.fila_id || "").trim() === fid)
    : lista.filter((f) => String(f.persona_id || "").trim() === pid);
  for (const f of candidatas) {
    const n = parseNivelJerarquico(f.nivel_jerarquico);
    if (n != null) return n;
  }
  return null;
}

/**
 * @param {{ gsoSoloLecturaMotivo?: string | null; gsoPermiteEscritura?: boolean }} vistaGso
 */
export function periodoGsoDesdeVista(vistaGso) {
  const motivo = vistaGso?.gsoSoloLecturaMotivo || null;
  return {
    cerrado: motivo === MOTIVO_PERIODO_CERRADO,
    ventanaM1: motivo === MOTIVO_VENTANA_MES_ANTERIOR,
  };
}

/**
 * @param {object} usuarioActual
 * @param {string} [usuarioActual.id]
 * @param {boolean} [usuarioActual.esJefe]
 * @param {boolean} [usuarioActual.esRrhh]
 * @param {number | null} [usuarioActual.nivelJerarquico]
 */
export function actorTeoriaDesdeSesion(usuarioActual) {
  const u = usuarioActual && typeof usuarioActual === "object" ? usuarioActual : {};
  const portal = actorTeoriaDesdePortal({
    id: u.id,
    esJefe: u.esJefe,
    esRrhh: u.esRrhh,
  });
  return {
    ...portal,
    nivelJerarquico: parseNivelJerarquico(u.nivelJerarquico) ?? 0,
  };
}

/**
 * @param {{
 *   usuarioActual?: object;
 *   agenteTarget?: object;
 *   estadoPlan?: string;
 *   periodoGso?: { cerrado?: boolean; ventanaM1?: boolean };
 *   esUrgenciaOperativa?: boolean;
 * }} opts
 */
export function evaluarCapabilitiesGestionTurno(opts) {
  const usuarioActual = opts?.usuarioActual || {};
  const agenteTarget = opts?.agenteTarget || {};
  const periodoGso = opts?.periodoGso || {};

  const contextoBase = {
    actor: actorTeoriaDesdeSesion(usuarioActual),
    target: {
      id: String(agenteTarget.id || "").trim() || undefined,
      nivelJerarquico: parseNivelJerarquico(agenteTarget.nivelJerarquico) ?? 0,
    },
    planEstado: opts?.estadoPlan || "HABILITADO",
    periodo: periodoGso,
    esUrgenciaOperativa: opts?.esUrgenciaOperativa === true,
  };

  const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contextoBase);

  let puedeGestionarTurno = resultado.permitido;
  let requiereUrgencia = false;
  let mensajeBloqueo = null;

  if (!resultado.permitido) {
    if (resultado.motivoRechazo === MOTIVOS_RECHAZO_TEORIA.PLAN_HABILITADO_REQUIERE_URGENCIA) {
      puedeGestionarTurno = true;
      requiereUrgencia = true;
    } else {
      puedeGestionarTurno = false;
      mensajeBloqueo = resultado.motivoRechazo;
    }
  }

  return {
    puedeGestionarTurno,
    requiereUrgencia,
    mensajeBloqueo,
    resultadoCrudo: resultado,
  };
}

/**
 * Listado / outbox sin agente concreto: RRHH o jefe con escritura GSO.
 * @param {{ esRrhh?: boolean; esJefe?: boolean; gsoPermiteEscritura?: boolean }} ctx
 */
export function puedeGestionarTurnoEnGrilla(ctx) {
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const tieneTarget = Boolean(c.agenteTarget || c.targetPersonaId);

  if (tieneTarget || c.usuarioActual) {
    const actor = actorTeoriaDesdeSesion(
      c.usuarioActual || {
        id: c.actorId,
        esJefe: c.esJefe,
        esRrhh: c.esRrhh,
        nivelJerarquico: c.nivelJerarquicoActor,
      },
    );
    if (!c.gsoPermiteEscritura && !esRrhhOperativo(actor)) {
      return false;
    }
    const cap = evaluarCapabilitiesGestionTurno({
      usuarioActual: c.usuarioActual || {
        id: c.actorId,
        esJefe: c.esJefe,
        esRrhh: c.esRrhh,
        nivelJerarquico: c.nivelJerarquicoActor,
      },
      agenteTarget: c.agenteTarget || {
        id: c.targetPersonaId,
        nivelJerarquico: c.nivelJerarquicoTarget,
      },
      estadoPlan: c.estadoPlan || "HABILITADO",
      periodoGso: c.periodoGso || {
        cerrado: c.periodoCerrado === true,
        ventanaM1: c.ventanaM1 === true,
      },
      esUrgenciaOperativa: c.esUrgenciaOperativa,
    });
    return cap.puedeGestionarTurno;
  }

  const rolOk = Boolean(c.esRrhh || c.esJefe);
  return rolOk && Boolean(c.gsoPermiteEscritura);
}

/**
 * @param {typeof GESTION_TURNO_ACCION[keyof typeof GESTION_TURNO_ACCION]} _accion
 * @param {Parameters<typeof puedeGestionarTurnoEnGrilla>[0]} ctx
 */
export function tieneCapabilityGestionTurno(_accion, ctx) {
  return puedeGestionarTurnoEnGrilla(ctx);
}

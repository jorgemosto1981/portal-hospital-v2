/**
 * Resúmenes de overrides aplicados + ops pendientes (modal detalle día).
 */
import { labelTurnoToken } from "./enrichCapaTeoricaLabels.js";
import { etiquetaSegmentosCompuesto } from "./grillaCambioTurnoPropioPreview.js";
import {
  formatFechaOutboxCorta,
  personaEtiquetaOutbox,
  resumenLineaOutboxOp,
  tipoFlujoOutbox,
} from "./grillaOutboxLabels.js";
import { opAfectaDia } from "./grillaCambioTurnoPropioPreview.js";

const TIPOS_GESTION = new Set(["cobertura_parcial", "reemplazo", "adicional"]);

/** @param {unknown} o @param {string} gdt */
export function overrideActivoEnGrupo(o, gdt) {
  if (!o || typeof o !== "object" || o.eliminado || o.invalidado_por_replanificacion) return false;
  const tipo = String(o.tipo || "").trim();
  if (!TIPOS_GESTION.has(tipo)) return false;
  const og = String(o.grupo_de_trabajo_id || o.grupo_trabajo_id || "").trim();
  return !gdt || og === gdt;
}

/**
 * @param {Record<string, unknown>} o
 * @param {string} personaId
 * @param {string} fechaYmd
 */
export function overrideAfectaCelda(o, personaId, fechaYmd) {
  const pid = String(personaId || "").trim();
  const f = String(fechaYmd || "").trim();
  const tipo = String(o.tipo || "").trim();
  if (tipo === "cobertura_parcial") {
    const po = String(o.persona_origen_id || "").trim();
    const pd = String(o.persona_cobertura_id || "").trim();
    const fo = String(o.fecha_origen || o.fecha || "").trim();
    const fd = String(o.fecha_destino || o.fecha || "").trim();
    return (pid === po && f === fo) || (pid === pd && f === fd);
  }
  if (tipo === "reemplazo" || tipo === "adicional") {
    const per = String(o.persona_id || "").trim();
    if (per !== pid) return false;
    const fo = String(o.fecha_origen || "").trim();
    const fd = String(o.fecha_destino || o.fecha || "").trim();
    if (tipo === "reemplazo") return f === fo || f === fd;
    return f === fd || f === String(o.fecha || "").trim();
  }
  return false;
}

function labelsTramos(ids, turnosPorId) {
  return etiquetaSegmentosCompuesto((ids || []).map(String), turnosPorId) || "—";
}

/**
 * @param {Record<string, unknown>} o
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {{ personaLabels?: Record<string, string>; turnosPorId?: Record<string, object> }} ctx
 */
export function tarjetaResumenOverride(o, personaId, fechaYmd, ctx = {}) {
  const { personaLabels = {}, turnosPorId = {} } = ctx;
  const meta = tipoFlujoOutbox({ tipo: o.tipo });
  const editor = personaEtiquetaOutbox(
    o.creado_por_persona_id,
    personaLabels,
    "",
  );
  const cuando = o.creado_en ? new Date(String(o.creado_en)).toLocaleString("es-AR") : "—";
  const ref = o.op_batch_id ? String(o.op_batch_id) : "";

  const tipo = String(o.tipo || "").trim();
  const pid = String(personaId || "").trim();
  const f = String(fechaYmd || "").trim();

  /** @type {{ enCaracterDe: string; quePaso: string; conQuien: string; cuandoQuien: string; referencia: string; verDia?: { label: string; personaId: string; fechaYmd: string } }} */
  const card = {
    enCaracterDe: meta.titulo,
    quePaso: "",
    conQuien: "",
    cuandoQuien: `Registrado el ${cuando}${editor !== "—" ? ` por ${editor}` : ""}.`,
    referencia: ref ? `Lote ${ref}` : "",
  };

  if (tipo === "cobertura_parcial") {
    const po = String(o.persona_origen_id || "").trim();
    const pd = String(o.persona_cobertura_id || "").trim();
    const fo = String(o.fecha_origen || o.fecha || "").trim();
    const fd = String(o.fecha_destino || o.fecha || "").trim();
    const segsO = o.segmentos_cedidos_origen || o.segmentos_cubiertos || [];
    const segsD = o.segmentos_cedidos_destino || [];
    if (pid === po && f === fo) {
      card.quePaso = `En este día: cedió ${labelsTramos(segsO, turnosPorId)} y recibió ${labelsTramos(segsD, turnosPorId)}.`;
      card.conQuien = `Con ${personaEtiquetaOutbox(pd, personaLabels)} (día ${formatFechaOutboxCorta(fd)}).`;
      card.verDia = { label: personaEtiquetaOutbox(pd, personaLabels), personaId: pd, fechaYmd: fd };
    } else if (pid === pd && f === fd) {
      card.quePaso = `En este día: cedió ${labelsTramos(segsD, turnosPorId)} y recibió ${labelsTramos(segsO, turnosPorId)}.`;
      card.conQuien = `Con ${personaEtiquetaOutbox(po, personaLabels)} (día ${formatFechaOutboxCorta(fo)}).`;
      card.verDia = { label: personaEtiquetaOutbox(po, personaLabels), personaId: po, fechaYmd: fo };
    }
  } else if (tipo === "reemplazo") {
    const fo = String(o.fecha_origen || "").trim();
    const fd = String(o.fecha_destino || o.fecha || "").trim();
    const trasl = o.segmentos_a_trasladar || o.segmentos_trasladar || [];
    const inc = o.segmentos_incorporados_destino || [o.turno_id].filter(Boolean);
    if (pid && f === fo) {
      card.quePaso = `Se trasladó ${labelsTramos(trasl, turnosPorId)} hacia el ${formatFechaOutboxCorta(fd)}.`;
      card.conQuien = `Destino del movimiento: ${formatFechaOutboxCorta(fd)} (mismo agente).`;
      card.verDia = { label: "Destino", personaId: pid, fechaYmd: fd };
      if (o.franco_en_origen === true) {
        card.quePaso += " El día de origen quedó franco tras el traslado.";
      }
    } else if (pid && f === fd) {
      card.quePaso = `Se incorporó ${labelsTramos(inc, turnosPorId)} desde el ${formatFechaOutboxCorta(fo)} (sin reemplazar tramos ya fijados en este día).`;
      card.conQuien = `Proveniente del ${formatFechaOutboxCorta(fo)} (mismo agente).`;
      card.verDia = { label: "Origen", personaId: pid, fechaYmd: fo };
    }
  } else if (tipo === "adicional") {
    const tid = String(o.turno_id || "").trim();
    const extra = labelsTramos([tid], turnosPorId) || labelTurnoToken(tid) || tid;
    card.quePaso = `Se agregó el turno ${extra} al teórico del día.`;
    card.conQuien = "Sobre el teórico ya calculado de este día (sin contraparte).";
    card.nota = "La imputación de horas extra se gestiona en trámite RRHH (fuera de la celda principal).";
  }

  return card;
}

/**
 * @param {Array<Record<string, unknown>>} opsPendientes
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {{ personaLabels?: Record<string, string>; turnosPorId?: Record<string, object> }} ctx
 */
export function lineasPendienteEnCola(opsPendientes, personaId, fechaYmd, ctx = {}) {
  return (opsPendientes || [])
    .filter((op) => opAfectaDia(op, personaId, fechaYmd))
    .map((op) => {
      const titulo = tipoFlujoOutbox(op).titulo;
      return `Pendiente de aplicar: ${titulo} — ${resumenLineaOutboxOp(op, ctx)}`;
    });
}

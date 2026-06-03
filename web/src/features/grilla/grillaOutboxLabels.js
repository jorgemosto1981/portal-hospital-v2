import { labelTurnoToken } from "./enrichCapaTeoricaLabels.js";
import { etiquetaSegmentosCompuesto } from "./grillaCambioTurnoPropioPreview.js";
import { esAdicionalV2 } from "./grillaAdicionalPreview.js";

/**
 * @param {string} ymd
 */
export function formatFechaOutboxCorta(ymd) {
  const f = String(ymd || "").trim();
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : f;
}

/**
 * @param {string} personaId
 * @param {Record<string, string>} [personaLabels]
 */
export function personaEtiquetaOutbox(personaId, personaLabels = {}) {
  const id = String(personaId || "").trim();
  if (!id) return "—";
  const lbl = String(personaLabels[id] || "").trim();
  if (lbl) {
    const apellido = lbl.split(",")[0]?.trim();
    if (apellido && apellido.length <= 22) return apellido;
    return lbl.length > 24 ? `${lbl.slice(0, 22)}…` : lbl;
  }
  const corto = id.replace(/^per_/, "");
  return corto.length > 8 ? `${corto.slice(0, 6)}…` : corto || id;
}

/**
 * @param {Record<string, unknown>} op
 */
export function tipoFlujoOutbox(op) {
  const t = String(op?.tipo || "").trim();
  if (t === "cobertura_parcial") {
    return { letra: "A", nombre: "Intercambio", clase: "bg-violet-100 text-violet-800" };
  }
  if (t === "reemplazo") {
    return { letra: "B", nombre: "Traslado", clase: "bg-amber-100 text-amber-900" };
  }
  if (t === "adicional") {
    return { letra: "C", nombre: "Extra", clase: "bg-blue-100 text-blue-800" };
  }
  return { letra: "?", nombre: t || "Cambio", clase: "bg-slate-100 text-slate-700" };
}

/**
 * @param {Record<string, unknown>} op
 */
function esIntercambioGuardiaV2(op) {
  return op?.tipo === "cobertura_parcial"
    && Boolean(String(op.personaDestinoId || op.persona_destino_id || op.personaCoberturaId || "").trim())
    && (
      Array.isArray(op.segmentosCedidosDestino)
      || Array.isArray(op.segmentos_cedidos_destino)
    );
}

/**
 * @param {Record<string, unknown>} op
 */
function esReemplazoPropioV2(op) {
  return op?.tipo === "reemplazo"
    && Boolean(String(op.fechaOrigenYmd || op.fecha_origen_ymd || "").trim());
}

/**
 * @param {unknown} prev
 */
function contextoDiaAdicional(prev) {
  if (!prev || typeof prev !== "object") return "sin preasignado";
  if (prev.es_franco === true) return "Franco";
  if (prev.es_no_laborable === true) return "No laborable";
  if (prev.es_feriado === true) {
    return prev.etiqueta_preasignada
      ? `${prev.etiqueta_preasignada} · Feriado`
      : "Feriado";
  }
  if (prev.etiqueta_preasignada) return String(prev.etiqueta_preasignada);
  return "sin preasignado";
}

/**
 * @param {Record<string, unknown>} op
 * @param {{ personaLabels?: Record<string, string>; turnosPorId?: Record<string, object> }} [ctx]
 */
export function resumenLineaOutboxOp(op, ctx = {}) {
  const personaLabels = ctx.personaLabels || {};
  const turnosPorId = ctx.turnosPorId || {};

  if (esIntercambioGuardiaV2(op)) {
    const po = personaEtiquetaOutbox(
      op.personaOrigenId || op.persona_origen_id,
      personaLabels,
    );
    const pd = personaEtiquetaOutbox(
      op.personaDestinoId || op.persona_destino_id || op.personaCoberturaId,
      personaLabels,
    );
    const fo = formatFechaOutboxCorta(op.fechaOrigenYmd || op.fecha_origen_ymd || op.fechaYmd || op.fecha);
    const fd = formatFechaOutboxCorta(op.fechaDestinoYmd || op.fecha_destino_ymd);
    const segsO = op.segmentosCedidosOrigen || op.segmentos_cedidos_origen || op.segmentosCubiertos || [];
    const segsD = op.segmentosCedidosDestino || op.segmentos_cedidos_destino || [];
    const lo = etiquetaSegmentosCompuesto(segsO.map(String), turnosPorId)
      || labelTurnoToken(String(segsO[0] || ""))
      || "—";
    const ld = etiquetaSegmentosCompuesto(segsD.map(String), turnosPorId)
      || labelTurnoToken(String(segsD[0] || ""))
      || "—";
    return `${po} ${fo} cede ${lo} ↔ ${pd} ${fd} cede ${ld}`;
  }

  if (esReemplazoPropioV2(op)) {
    const p = personaEtiquetaOutbox(op.personaId || op.persona_id, personaLabels);
    const fo = formatFechaOutboxCorta(op.fechaOrigenYmd || op.fecha_origen_ymd);
    const fd = formatFechaOutboxCorta(op.fechaDestinoYmd || op.fecha_destino_ymd || op.fechaYmd || op.fecha);
    const quita = etiquetaSegmentosCompuesto(
      (op.segmentosTrasladar || op.segmentos_trasladar || []).map(String),
      turnosPorId,
    ) || "—";
    const incorporados = op.segmentosIncorporadosDestino || op.segmentos_incorporados_destino;
    const sumaIds = Array.isArray(incorporados) && incorporados.length
      ? incorporados.map(String)
      : [op.turnoIdDestino || op.turno_id_destino].filter(Boolean).map(String);
    const suma = etiquetaSegmentosCompuesto(sumaIds, turnosPorId) || "—";
    const franco = (op.francoEnOrigen || op.franco_en_origen) === true ? " · origen franco" : "";
    return `${p}: quita ${quita} (${fo}) → suma ${suma} (${fd})${franco}`;
  }

  if (op?.tipo === "adicional") {
    const p = personaEtiquetaOutbox(op.personaId || op.persona_id, personaLabels);
    const f = formatFechaOutboxCorta(op.fechaYmd || op.fecha);
    const tid = String(op.turnoId || op.turno_id || op.turnoIdAdicional || "").trim();
    const extra = etiquetaSegmentosCompuesto([tid], turnosPorId)
      || labelTurnoToken(tid)
      || tid
      || "—";
    const prev = op.estadoPrevio || op.estado_previo;
    const ctxDia = contextoDiaAdicional(prev);
    const v2 = esAdicionalV2(op) ? "" : " (legacy)";
    return `${p} · ${f} · ${ctxDia} · extra +${extra}${v2}`;
  }

  const tipo = String(op?.tipo || "cambio");
  const f = formatFechaOutboxCorta(op?.fechaYmd || op?.fecha);
  const p = personaEtiquetaOutbox(op?.personaId || op?.persona_id, personaLabels);
  return `${p} · ${f} · ${tipo}`;
}

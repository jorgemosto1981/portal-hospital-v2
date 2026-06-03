import { labelTurnoToken } from "./enrichCapaTeoricaLabels.js";
import { etiquetaSegmentosCompuesto } from "./grillaCambioTurnoPropioPreview.js";
import { esAdicionalV2 } from "./grillaAdicionalPreview.js";
import { GESTION_TURNO_OPCIONES } from "./gestionTurnoWizardOpciones.js";

const TITULO_POR_TIPO = Object.fromEntries(
  GESTION_TURNO_OPCIONES.map((o) => [o.id, o.titulo]),
);
const ORDEN_TIPOS_OUTBOX = ["cobertura_parcial", "reemplazo", "adicional"];

/**
 * @param {string} ymd
 */
export function formatFechaOutboxCorta(ymd) {
  const f = String(ymd || "").trim();
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : f;
}

const TITULAR_SIN_GRUPO = "Titular (mi caso)";

/**
 * @param {string} label
 */
function apellidoDesdeLabelPersona(label) {
  const lbl = String(label || "").trim();
  if (!lbl) return "";
  const apellido = lbl.split(",")[0]?.trim();
  if (apellido && apellido.length <= 22) return apellido;
  return lbl.length > 24 ? `${lbl.slice(0, 22)}…` : lbl;
}

/**
 * @param {string} personaId
 * @param {Record<string, string>} [personaLabels]
 * @param {string} [directLabel] etiqueta persistida en la op al encolar
 */
export function personaEtiquetaOutbox(personaId, personaLabels = {}, directLabel = "") {
  const id = String(personaId || "").trim();
  if (!id) return "—";
  const directo = apellidoDesdeLabelPersona(directLabel);
  if (directo) return directo;
  const lbl = String(personaLabels[id] || "").trim();
  if (lbl) return apellidoDesdeLabelPersona(lbl) || "—";
  const corto = id.replace(/^per_/, "");
  return corto.length > 8 ? `${corto.slice(0, 6)}…` : corto || id;
}

/**
 * Fusiona etiquetas de persona embebidas en ops con un mapa externo (p. ej. filas cargadas).
 * @param {Array<Record<string, unknown>>} ops
 * @param {Record<string, string>} [base]
 */
export function mergePersonaLabelsDesdeOps(ops, base = {}) {
  /** @type {Record<string, string>} */
  const merged = { ...base };
  for (const op of ops) {
    const pairs = [
      [op.personaOrigenId || op.persona_origen_id, op.personaOrigenLabel || op.persona_origen_label],
      [
        op.personaDestinoId || op.persona_destino_id || op.personaCoberturaId,
        op.personaDestinoLabel || op.persona_destino_label,
      ],
      [
        op.personaId || op.persona_id,
        op.personaLabel || op.persona_label || op.personaNombre || op.persona_nombre,
      ],
    ];
    for (const [pidRaw, lblRaw] of pairs) {
      const pid = String(pidRaw || "").trim();
      const lbl = String(lblRaw || "").trim();
      if (pid && lbl) merged[pid] = lbl;
    }
  }
  return merged;
}

/**
 * @param {string} periodo YYYY-MM
 */
export function labelPeriodoOutbox(periodo) {
  const f = String(periodo || "").trim();
  const m = f.match(/^(\d{4})-(\d{2})$/);
  if (!m) return f || "—";
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return f;
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {Record<string, unknown>} op
 */
export function claveTarjetaOutbox(op) {
  const grupoId = String(op.grupoId || op.grupo_id || "").trim();
  const periodo = String(op.periodo || "").trim();
  return `${periodo || "-"}::${grupoId || "-"}`;
}

/**
 * @param {Record<string, unknown>} op
 * @param {Record<string, string>} [grupoLabels]
 */
export function tituloGrupoOutboxOp(op, grupoLabels = {}) {
  const stored = String(op.grupoLabel || op.grupo_label || "").trim();
  if (stored) return stored;
  const grupoId = String(op.grupoId || op.grupo_id || "").trim();
  if (!grupoId) return TITULAR_SIN_GRUPO;
  return String(grupoLabels[grupoId] || grupoId).trim() || grupoId;
}

/**
 * Agrupa ops por tarjeta calendario (grupo × mes/año).
 * @param {Array<Record<string, unknown>>} ops
 */
export function agruparOpsOutboxPorTarjeta(ops) {
  /** @type {Map<string, { key: string; grupoId: string; periodo: string; ops: Array<Record<string, unknown>> }>} */
  const map = new Map();

  for (const op of ops) {
    const key = claveTarjetaOutbox(op);
    if (!map.has(key)) {
      map.set(key, {
        key,
        grupoId: String(op.grupoId || op.grupo_id || "").trim(),
        periodo: String(op.periodo || "").trim(),
        ops: [],
      });
    }
    map.get(key).ops.push(op);
  }

  return [...map.values()].sort((a, b) => {
    const pc = a.periodo.localeCompare(b.periodo);
    if (pc !== 0) return pc;
    return a.grupoId.localeCompare(b.grupoId, "es", { sensitivity: "base" });
  });
}

/**
 * @param {Record<string, unknown>} op
 */
export function tipoFlujoOutbox(op) {
  const t = String(op?.tipo || "").trim();
  if (t === "cobertura_parcial") {
    return {
      tipo: t,
      titulo: TITULO_POR_TIPO.cobertura_parcial || "Intercambio de guardia",
      clase: "text-violet-900",
      claseGrupo: "border-violet-200 bg-violet-50/80",
    };
  }
  if (t === "reemplazo") {
    return {
      tipo: t,
      titulo: TITULO_POR_TIPO.reemplazo || "Cambio de turno propio",
      clase: "text-amber-950",
      claseGrupo: "border-amber-200 bg-amber-50/80",
    };
  }
  if (t === "adicional") {
    return {
      tipo: t,
      titulo: TITULO_POR_TIPO.adicional || "Horas adicionales",
      clase: "text-blue-900",
      claseGrupo: "border-blue-200 bg-blue-50/80",
    };
  }
  const fallback = t || "Cambio";
  return {
    tipo: t || "otro",
    titulo: fallback,
    clase: "text-slate-800",
    claseGrupo: "border-slate-200 bg-slate-50/80",
  };
}

/**
 * Agrupa ops del outbox por título de función (A/B/C).
 * @param {Array<Record<string, unknown>>} ops
 */
export function agruparOpsOutboxPorTitulo(ops) {
  /** @type {Map<string, { tipo: string; titulo: string; clase: string; claseGrupo: string; ops: Array<Record<string, unknown>> }>} */
  const map = new Map();

  for (const op of ops) {
    const meta = tipoFlujoOutbox(op);
    const key = meta.tipo;
    if (!map.has(key)) {
      map.set(key, {
        tipo: key,
        titulo: meta.titulo,
        clase: meta.clase,
        claseGrupo: meta.claseGrupo,
        ops: [],
      });
    }
    map.get(key).ops.push(op);
  }

  const ordenados = ORDEN_TIPOS_OUTBOX
    .filter((t) => map.has(t))
    .map((t) => map.get(t));

  for (const [key, grupo] of map) {
    if (!ORDEN_TIPOS_OUTBOX.includes(key)) ordenados.push(grupo);
  }

  return ordenados;
}

/**
 * Id estable de una op en outbox (siempre preferir op.id).
 * @param {Record<string, unknown>} op
 * @param {number} idx
 */
export function outboxOpId(op, idx = 0) {
  return String(op?.id || `idx_${idx}`);
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
      op.personaOrigenLabel || op.persona_origen_label,
    );
    const pd = personaEtiquetaOutbox(
      op.personaDestinoId || op.persona_destino_id || op.personaCoberturaId,
      personaLabels,
      op.personaDestinoLabel || op.persona_destino_label,
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
    const p = personaEtiquetaOutbox(
      op.personaId || op.persona_id,
      personaLabels,
      op.personaLabel || op.persona_label || op.personaNombre || op.persona_nombre,
    );
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
    const p = personaEtiquetaOutbox(
      op.personaId || op.persona_id,
      personaLabels,
      op.personaLabel || op.persona_label || op.personaNombre || op.persona_nombre,
    );
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
  const p = personaEtiquetaOutbox(
    op?.personaId || op?.persona_id,
    personaLabels,
    op?.personaLabel || op?.persona_label || op?.personaNombre || op?.persona_nombre,
  );
  return `${p} · ${f} · ${tipo}`;
}

import { parseFichadasEsperadasCelda } from "./grillaFichadasEsperadasDisplay.js";
import {
  etiquetaSegmentosCompuesto,
  horasDeSegmento,
  proyectarDiaConOpsPendientes,
  rangoFechasMes,
  segmentoIdsDesdeCapa,
  TOPE_HORAS_DIA,
} from "./grillaCambioTurnoPropioPreview.js";
import seedIds from "../../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json" with { type: "json" };

export const DEFAULT_TCC_CAMBIO_INTERNO =
  seedIds.cfg_tipo_compensacion_cobertura?.CAMBIO_INTERNO || "";

/**
 * @param {string[]} ids
 * @param {Record<string, object>} turnosPorId
 * @param {Array<{ segmento_id?: string; horas_efectivas?: number }>} [segmentosCapa]
 */
export function horasTotalesSegmentos(ids, turnosPorId = {}, segmentosCapa = []) {
  return (ids || []).reduce(
    (sum, id) => sum + horasDeSegmento(id, turnosPorId, segmentosCapa),
    0,
  );
}

/**
 * A1 / A1b — día laborable materializado con fichada esperada (capa API).
 * @param {unknown} capa
 * @param {{ segmentoIds?: string[] }} [preview]
 */
export function capaElegibleIntercambioGuardia(capa, preview = null) {
  if (!capa || typeof capa !== "object") {
    return { ok: false, error: "Sin turno materializado en este día." };
  }
  const tipo = String(capa.tipo_dia || "").toLowerCase();
  if (tipo === "franco" || tipo === "no_laborable" || tipo === "no-laborable") {
    return { ok: false, error: "Franco o no laborable: no aplica intercambio de guardia." };
  }
  const idsPreview = preview?.segmentoIds;
  const ids = Array.isArray(idsPreview) && idsPreview.length
    ? idsPreview
    : segmentoIdsDesdeCapa(capa);
  if (!ids.length) {
    const msg = preview?.tienePreviewPendiente
      ? "Sin tramos disponibles tras borradores pendientes en este día."
      : "Sin segmentos materializados. Calculá el día antes de intercambiar.";
    return { ok: false, error: msg };
  }
  const fichadas = parseFichadasEsperadasCelda(capa.fichadas_esperadas);
  if (fichadas == null || fichadas < 1) {
    return {
      ok: false,
      error: "Este día no tiene fichada esperada; no aplica intercambio de guardia.",
    };
  }
  return { ok: true, segmentoIds: ids, fichadas };
}

/**
 * A-N5 — rechaza swap sin efecto neto en el mismo día (mismos tramos cedidos).
 * @param {string[]} segmentosCedidosOrigen
 * @param {string[]} segmentosCedidosDestino
 * @param {string} [fechaOrigenYmd]
 * @param {string} [fechaDestinoYmd]
 */
export function validarAntiNoopIntercambio(
  segmentosCedidosOrigen,
  segmentosCedidosDestino,
  fechaOrigenYmd = "",
  fechaDestinoYmd = "",
) {
  const fA = String(fechaOrigenYmd || "").trim();
  const fB = String(fechaDestinoYmd || "").trim();
  if (!fA || fA !== fB) return { ok: true };

  const a = [...new Set((segmentosCedidosOrigen || []).map(String).filter(Boolean))].sort();
  const b = [...new Set((segmentosCedidosDestino || []).map(String).filter(Boolean))].sort();
  if (a.length && a.length === b.length && a.every((id, i) => id === b[i])) {
    return {
      ok: false,
      error: "Intercambio sin efecto: ambos agentes ceden los mismos tramos el mismo día.",
    };
  }
  return { ok: true };
}

/**
 * A-N2 — tope 24 h tras aplicar el swap sobre preview acumulado.
 */
export function validarTopeHorasPostSwap(idsPostSwap, turnosPorId, segmentosCapa, ladoLabel = "") {
  const pref = ladoLabel ? `${ladoLabel}: ` : "";
  const horas = (idsPostSwap || []).reduce(
    (sum, id) => sum + horasDeSegmento(id, turnosPorId, segmentosCapa),
    0,
  );
  if (horas > TOPE_HORAS_DIA) {
    return {
      ok: false,
      error: `${pref}Supera ${TOPE_HORAS_DIA} h tras el intercambio (${horas} h con preview).`,
      horas,
    };
  }
  return { ok: true, horas };
}

/** @param {string[]} idsPreview @param {string[]} cedidos @param {string[]} recibidos */
export function segmentoIdsPostSwap(idsPreview, cedidos, recibidos) {
  const quitar = new Set((cedidos || []).map(String));
  const ids = (idsPreview || []).filter((id) => !quitar.has(String(id)));
  for (const raw of recibidos || []) {
    const id = String(raw || "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * @param {string[]} seleccionados
 * @param {string[]} disponibles
 */
export function validarSubsetSegmentosCedidos(seleccionados, disponibles) {
  const disp = new Set((disponibles || []).map(String).filter(Boolean));
  const sel = [...new Set((seleccionados || []).map(String).filter(Boolean))];
  if (!sel.length) {
    return { ok: false, error: "Seleccioná al menos un tramo a ceder." };
  }
  const invalidos = sel.filter((id) => !disp.has(id));
  if (invalidos.length) {
    return { ok: false, error: "Algún tramo marcado no pertenece al turno teórico de ese día." };
  }
  return { ok: true, segmentos: sel };
}

/**
 * A-TIPO — intercambio no aplica a régimen fijo (solo rotativo o planificado).
 * @param {string} regimenHorarioId
 * @param {Record<string, { tipo_patron?: string; nombre?: string; etiqueta?: string }>} [regimenesIdx]
 */
export function regimenPermiteIntercambioGuardia(regimenHorarioId, regimenesIdx = {}) {
  const id = String(regimenHorarioId || "").trim();
  if (!id) {
    return { ok: false, error: "No se pudo determinar el régimen horario del agente." };
  }
  const doc = regimenesIdx[id] || {};
  const tipo = String(doc.tipo_patron || "").trim().toLowerCase();
  if (tipo === "fijo") {
    const lbl = doc.nombre || doc.etiqueta || "régimen fijo";
    return {
      ok: false,
      error:
        `El intercambio de guardia no aplica a régimen fijo (${lbl}). `
        + "Usá «Cambio de turno propio» para trasladar el día.",
    };
  }
  return { ok: true, tipoPatron: tipo || null };
}

/**
 * A-REG — intercambio solo entre agentes con el mismo `regimen_horario_id` en el cargo/período.
 * @param {string} regimenIdOrigen
 * @param {string} regimenIdDestino
 * @param {Record<string, { nombre?: string; etiqueta?: string }>} [regimenesIdx]
 */
export function validarMismoRegimenHorario(regimenIdOrigen, regimenIdDestino, regimenesIdx = {}) {
  const a = String(regimenIdOrigen || "").trim();
  const b = String(regimenIdDestino || "").trim();
  if (!a) {
    return { ok: false, error: "No se pudo determinar el régimen horario del agente 1." };
  }
  if (!b) {
    return { ok: false, error: "El agente 2 no tiene régimen horario asignado en este cargo." };
  }
  if (a !== b) {
    const metaA = regimenesIdx[a] || {};
    const metaB = regimenesIdx[b] || {};
    const lblA = metaA.nombre || metaA.etiqueta || a;
    const lblB = metaB.nombre || metaB.etiqueta || b;
    return {
      ok: false,
      error:
        `Régimen horario distinto (${lblA} ↔ ${lblB}). `
        + "El intercambio de guardia solo aplica entre agentes con el mismo régimen en el cargo.",
    };
  }
  return { ok: true, regimenHorarioId: a };
}

/**
 * Tramos cedidos deben existir en el catálogo del régimen o en la capa materializada del día.
 * @param {string[]} segmentoIds
 * @param {Record<string, object>} turnosPorId
 * @param {Array<{ segmento_id?: string }>} [segmentosCapa]
 * @param {string} ladoLabel
 */
export function validarSegmentosEnRegimen(segmentoIds, turnosPorId = {}, segmentosCapa = [], ladoLabel = "") {
  const pref = ladoLabel ? `${ladoLabel}: ` : "";
  const idsCapa = new Set((segmentosCapa || []).map((s) => String(s.segmento_id || "").trim()).filter(Boolean));
  const invalidos = (segmentoIds || []).filter((id) => {
    const sid = String(id || "").trim();
    if (!sid) return true;
    if (turnosPorId[sid]) return false;
    return !idsCapa.has(sid);
  });
  if (invalidos.length) {
    return {
      ok: false,
      error: `${pref}Algún tramo no pertenece al régimen horario del agente.`,
    };
  }
  return { ok: true };
}

/**
 * A2 — emparejamiento parcial: misma carga horaria entre lados.
 * @param {number} horasOrigen
 * @param {number} horasDestino
 */
export function validarEmparejamientoHoras(horasOrigen, horasDestino) {
  if (horasOrigen <= 0 || horasDestino <= 0) {
    return { ok: false, error: "Ambos agentes deben ceder al menos un tramo con horas." };
  }
  if (horasOrigen !== horasDestino) {
    return {
      ok: false,
      error: `La carga cedida debe ser equivalente (${horasOrigen} h ≠ ${horasDestino} h).`,
      horasOrigen,
      horasDestino,
    };
  }
  return { ok: true, horas: horasOrigen };
}

/**
 * @param {{
 *   personaOrigenId: string;
 *   personaDestinoId: string;
 *   fechaOrigenYmd: string;
 *   fechaDestinoYmd: string;
 *   periodo: string;
 *   segmentosCedidosOrigen: string[];
 *   segmentosCedidosDestino: string[];
 *   capaOrigen: unknown;
 *   capaDestino: unknown;
 *   turnosPorIdOrigen?: Record<string, object>;
 *   turnosPorIdDestino?: Record<string, object>;
 *   regimenHorarioIdOrigen?: string;
 *   regimenHorarioIdDestino?: string;
 *   regimenesIdx?: Record<string, object>;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   excluirOpId?: string;
 * }} params
 */
export function validarIntercambioGuardia(params) {
  const {
    personaOrigenId,
    personaDestinoId,
    fechaOrigenYmd,
    fechaDestinoYmd,
    periodo,
    segmentosCedidosOrigen,
    segmentosCedidosDestino,
    capaOrigen,
    capaDestino,
    turnosPorIdOrigen = {},
    turnosPorIdDestino = {},
    regimenHorarioIdOrigen = "",
    regimenHorarioIdDestino = "",
    regimenesIdx = {},
    opsPendientes = [],
    excluirOpId = "",
  } = params;

  const excluirId = String(excluirOpId || "").trim();
  const ops = (opsPendientes || []).filter(
    (op) => !excluirId || String(op.id || "").trim() !== excluirId,
  );

  const perA = String(personaOrigenId || "").trim();
  const perB = String(personaDestinoId || "").trim();
  if (!perA || !perB) {
    return { ok: false, error: "Elegí los dos agentes del intercambio." };
  }
  if (perA === perB) {
    return { ok: false, error: "El intercambio requiere dos agentes distintos." };
  }

  const fA = String(fechaOrigenYmd || "").trim();
  const fB = String(fechaDestinoYmd || "").trim();
  if (!fA || !fB) {
    return { ok: false, error: "Elegí las dos fechas del intercambio." };
  }
  const mes = String(periodo || "").trim();
  if (mes && (fA.slice(0, 7) !== mes || fB.slice(0, 7) !== mes)) {
    return { ok: false, error: "Ambas fechas deben estar en el mismo mes del período." };
  }

  const tipoReg = regimenPermiteIntercambioGuardia(regimenHorarioIdOrigen, regimenesIdx);
  if (!tipoReg.ok) return tipoReg;

  const reg = validarMismoRegimenHorario(regimenHorarioIdOrigen, regimenHorarioIdDestino, regimenesIdx);
  if (!reg.ok) return reg;

  const previewA = proyectarDiaConOpsPendientes(
    capaOrigen,
    ops,
    perA,
    fA,
    turnosPorIdOrigen,
  );
  const previewB = proyectarDiaConOpsPendientes(
    capaDestino,
    ops,
    perB,
    fB,
    turnosPorIdDestino,
  );

  const elegA = capaElegibleIntercambioGuardia(capaOrigen, previewA);
  if (!elegA.ok) return elegA;
  const elegB = capaElegibleIntercambioGuardia(capaDestino, previewB);
  if (!elegB.ok) return { ...elegB, error: `Agente 2: ${elegB.error}` };

  const noop = validarAntiNoopIntercambio(
    segmentosCedidosOrigen,
    segmentosCedidosDestino,
    fA,
    fB,
  );
  if (!noop.ok) return noop;

  const subA = validarSubsetSegmentosCedidos(segmentosCedidosOrigen, previewA.segmentoIds);
  if (!subA.ok) {
    return {
      ...subA,
      error: previewA.tienePreviewPendiente
        ? `Agente 1: ${subA.error} Revisá borradores pendientes.`
        : `Agente 1: ${subA.error}`,
    };
  }
  const subB = validarSubsetSegmentosCedidos(segmentosCedidosDestino, previewB.segmentoIds);
  if (!subB.ok) {
    return {
      ...subB,
      error: previewB.tienePreviewPendiente
        ? `Agente 2: ${subB.error} Revisá borradores pendientes.`
        : `Agente 2: ${subB.error}`,
    };
  }

  const segsA = previewA.segmentosCapa;
  const segsB = previewB.segmentosCapa;

  const enRegA = validarSegmentosEnRegimen(subA.segmentos, turnosPorIdOrigen, segsA, "Agente 1");
  if (!enRegA.ok) return enRegA;
  const enRegB = validarSegmentosEnRegimen(subB.segmentos, turnosPorIdDestino, segsB, "Agente 2");
  if (!enRegB.ok) return enRegB;

  const horasA = horasTotalesSegmentos(subA.segmentos, turnosPorIdOrigen, segsA);
  const horasB = horasTotalesSegmentos(subB.segmentos, turnosPorIdDestino, segsB);
  const par = validarEmparejamientoHoras(horasA, horasB);
  if (!par.ok) return par;

  const idsPostA = segmentoIdsPostSwap(previewA.segmentoIds, subA.segmentos, subB.segmentos);
  const idsPostB = segmentoIdsPostSwap(previewB.segmentoIds, subB.segmentos, subA.segmentos);
  const topeA = validarTopeHorasPostSwap(idsPostA, turnosPorIdOrigen, segsA, "Agente 1");
  if (!topeA.ok) return topeA;
  const topeB = validarTopeHorasPostSwap(idsPostB, turnosPorIdDestino, segsB, "Agente 2");
  if (!topeB.ok) return topeB;

  return {
    ok: true,
    preview: {
      origen: {
        personaId: perA,
        fecha: fA,
        cede: etiquetaSegmentosCompuesto(subA.segmentos, turnosPorIdOrigen),
        recibe: etiquetaSegmentosCompuesto(subB.segmentos, turnosPorIdDestino),
        horas: horasA,
        despues: etiquetaSegmentosCompuesto(idsPostA, turnosPorIdOrigen),
      },
      destino: {
        personaId: perB,
        fecha: fB,
        cede: etiquetaSegmentosCompuesto(subB.segmentos, turnosPorIdDestino),
        recibe: etiquetaSegmentosCompuesto(subA.segmentos, turnosPorIdOrigen),
        horas: horasB,
        despues: etiquetaSegmentosCompuesto(idsPostB, turnosPorIdDestino),
      },
    },
    segmentosCedidosOrigen: subA.segmentos,
    segmentosCedidosDestino: subB.segmentos,
    previewOrigen: previewA,
    previewDestino: previewB,
  };
}

/**
 * @param {Record<string, unknown>} op
 */
export function esIntercambioGuardiaV2(op) {
  return (
    op?.tipo === "cobertura_parcial"
    && Boolean(op.personaOrigenId)
    && Boolean(op.personaDestinoId)
    && Boolean(op.fechaOrigenYmd)
    && Boolean(op.fechaDestinoYmd)
    && Array.isArray(op.segmentosCedidosOrigen)
    && op.segmentosCedidosOrigen.length > 0
    && Array.isArray(op.segmentosCedidosDestino)
    && op.segmentosCedidosDestino.length > 0
  );
}

/**
 * Outbox Flujo A — RFC §3.1.
 * @param {{
 *   id?: string;
 *   personaOrigenId: string;
 *   personaDestinoId: string;
 *   fechaOrigenYmd: string;
 *   fechaDestinoYmd: string;
 *   segmentosCedidosOrigen: string[];
 *   segmentosCedidosDestino: string[];
 *   tipoCompensacionId?: string;
 *   motivo: string;
 *   expectedVersionTokenOrigen: string;
 *   expectedVersionTokenDestino: string;
 *   grupoId: string;
 *   periodo: string;
 *   creado_en?: string;
 * }} params
 */
export function buildIntercambioGuardiaOutboxOp(params) {
  const segsA = [...new Set((params.segmentosCedidosOrigen || []).map(String).filter(Boolean))];
  const segsB = [...new Set((params.segmentosCedidosDestino || []).map(String).filter(Boolean))];
  const tcc = String(params.tipoCompensacionId || DEFAULT_TCC_CAMBIO_INTERNO).trim();
  return {
    id: params.id,
    creado_en: params.creado_en,
    tipo: "cobertura_parcial",
    personaOrigenId: params.personaOrigenId,
    personaDestinoId: params.personaDestinoId,
    fechaOrigenYmd: params.fechaOrigenYmd,
    fechaDestinoYmd: params.fechaDestinoYmd,
    fechaYmd: params.fechaOrigenYmd,
    segmentosCedidosOrigen: segsA,
    segmentosCedidosDestino: segsB,
    segmentosCubiertos: segsA,
    personaCoberturaId: params.personaDestinoId,
    tipoCompensacionId: tcc,
    motivo: String(params.motivo || "").trim(),
    expectedVersionTokenOrigen: String(params.expectedVersionTokenOrigen || "").trim(),
    expectedVersionTokenDestino: String(params.expectedVersionTokenDestino || "").trim(),
    expectedVersionToken: String(params.expectedVersionTokenOrigen || "").trim(),
    grupoId: params.grupoId,
    periodo: params.periodo,
  };
}

export { rangoFechasMes };

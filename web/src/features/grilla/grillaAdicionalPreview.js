import {
  etiquetaSegmentosCompuesto,
  horasDeSegmento,
  proyectarDiaConOpsPendientes,
  segmentoIdsDesdeCapa,
  TOPE_HORAS_DIA,
} from "./grillaCambioTurnoPropioPreview.js";

/**
 * @param {unknown} capa
 */
export function esFeriadoDesdeCapa(capa) {
  if (!capa || typeof capa !== "object") return false;
  if (capa.es_feriado === true) return true;
  const tipo = String(capa.tipo_dia || "").trim().toLowerCase();
  return tipo === "feriado";
}

/**
 * @param {unknown} capa
 */
export function esNoLaborableDesdeCapa(capa) {
  if (!capa || typeof capa !== "object") return false;
  const tipo = String(capa.tipo_dia || "").trim().toLowerCase();
  return tipo === "no_laborable" || tipo === "no-laborable";
}

/**
 * @param {unknown} capa
 */
export function esFrancoDesdeCapa(capa) {
  if (!capa || typeof capa !== "object") return false;
  if (capa.es_franco === true) return true;
  const tipo = String(capa.tipo_dia || "").trim().toLowerCase();
  return tipo === "franco";
}

/**
 * Día con teórico laborable materializado (segmentos o turno simple).
 * Franco / no laborable sin tramos → false (C permite agregar turno extra).
 * @param {unknown} capa
 */
export function capaTieneTeoricoLaborable(capa) {
  if (!capa || typeof capa !== "object") return false;
  if (esFrancoDesdeCapa(capa) || esNoLaborableDesdeCapa(capa)) {
    return false;
  }
  return segmentoIdsDesdeCapa(capa).length > 0;
}

/**
 * C-SNAPSHOT — foto del día **antes** del turno adicional (capa ± borradores previos).
 * Separa horas preasignadas vs horas extra para evaluación RRHH (simple / doble).
 * @param {unknown} capa
 * @param {Record<string, object>} [turnosPorId]
 * @param {{ segmentoIds?: string[]; segmentosCapa?: Array<{ segmento_id?: string }>; horas?: number } | null} [preview]
 */
export function capturarEstadoPrevioDia(capa, turnosPorId = {}, preview = null) {
  const tipo = String(capa?.tipo_dia || "").trim().toLowerCase() || null;
  const es_franco = esFrancoDesdeCapa(capa);
  const es_feriado = esFeriadoDesdeCapa(capa);
  const es_no_laborable = esNoLaborableDesdeCapa(capa);

  const segmentoIds = preview?.segmentoIds?.length
    ? [...preview.segmentoIds]
    : segmentoIdsDesdeCapa(capa);
  const segsCapa = preview?.segmentosCapa?.length
    ? preview.segmentosCapa
    : (Array.isArray(capa?.segmentos) ? capa.segmentos : []);

  let horas_preasignadas = 0;
  if (typeof preview?.horas === "number") {
    horas_preasignadas = preview.horas;
  } else if (typeof capa?.horas_teoricas_totales === "number") {
    horas_preasignadas = capa.horas_teoricas_totales;
  } else {
    horas_preasignadas = segmentoIds.reduce(
      (sum, id) => sum + horasDeSegmento(id, turnosPorId, segsCapa),
      0,
    );
  }

  let turno_preasignado_id = null;
  if (segmentoIds.length === 1) {
    turno_preasignado_id = segmentoIds[0];
  } else if (segmentoIds.length > 1) {
    const comp = String(capa?.turno_compuesto_id || "").trim();
    turno_preasignado_id = comp || segmentoIds.join("+");
  }

  return {
    es_franco,
    es_feriado,
    es_no_laborable,
    tipo_dia: tipo,
    turno_preasignado_id,
    segmentos_preasignados: segmentoIds,
    etiqueta_preasignada: segmentoIds.length
      ? etiquetaSegmentosCompuesto(segmentoIds, turnosPorId)
      : null,
    horas_preasignadas,
  };
}

/**
 * Horas del turno adicional (extra, fuera del teórico preasignado).
 * @param {string} turnoId
 * @param {Record<string, object>} [turnosPorId]
 * @param {Array<{ segmento_id?: string }>} [segmentosCapa]
 */
export function horasAdicionalesDelTurno(turnoId, turnosPorId = {}, segmentosCapa = []) {
  const tid = String(turnoId || "").trim();
  if (!tid) return 0;
  return horasDeSegmento(tid, turnosPorId, segmentosCapa);
}

/**
 * C-N1 — turno adicional ≠ teórico del día si ya hay teórico laborable (capa + borradores).
 * @param {string} turnoId
 * @param {unknown} capa
 * @param {string[]} [segmentoIdsProyectados]
 * @param {Record<string, object>} [turnosPorId]
 */
export function validarAdicionalCN1(turnoId, capa, segmentoIdsProyectados = null, turnosPorId = {}) {
  const tid = String(turnoId || "").trim();
  if (!tid) {
    return { ok: false, error: "Elegí el turno adicional del régimen." };
  }
  if (!capaTieneTeoricoLaborable(capa)) {
    return { ok: true };
  }
  const ids = Array.isArray(segmentoIdsProyectados) && segmentoIdsProyectados.length
    ? segmentoIdsProyectados
    : segmentoIdsDesdeCapa(capa);
  if (ids.includes(tid)) {
    const lbl = etiquetaSegmentosCompuesto([tid], turnosPorId);
    return {
      ok: false,
      error: `No podés agregar ${lbl}: ya figura en el turno teórico de este día.`,
    };
  }
  return { ok: true };
}

/**
 * Tramos del teórico preasignado que el jefe puede declarar (Flujo C — cumplimiento fichada).
 * @param {{
 *   capa: unknown;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaYmd: string;
 *   turnosPorId?: Record<string, object>;
 * }} params
 */
export function turnosPreasignadosDeclarablesEnDia(params) {
  const {
    capa,
    opsPendientes = [],
    personaId,
    fechaYmd,
    turnosPorId = {},
  } = params;
  if (!capaTieneTeoricoLaborable(capa)) {
    return { opciones: [], preview: null };
  }
  const preview = proyectarDiaConOpsPendientes(
    capa,
    opsPendientes,
    personaId,
    fechaYmd,
    turnosPorId,
  );
  const estadoPrevio = capturarEstadoPrevioDia(capa, turnosPorId, preview);
  const ids = Array.isArray(estadoPrevio.segmentos_preasignados)
    ? estadoPrevio.segmentos_preasignados.map(String).filter(Boolean)
    : [];
  const opciones = ids
    .filter((id) => turnosPorId[id])
    .map((turno_id) => ({
      turno_id,
      meta: turnosPorId[turno_id] || {},
    }));
  return { opciones, preview, estadoPrevio };
}

/**
 * C-N2 — tope 24 h tras sumar el turno adicional sobre preview acumulado.
 */
export function validarTopeHorasPostAdicional(horasPreview, turnoId, turnosPorId = {}, segmentosCapa = []) {
  const extra = horasAdicionalesDelTurno(turnoId, turnosPorId, segmentosCapa);
  const total = (horasPreview || 0) + extra;
  if (total > TOPE_HORAS_DIA) {
    return {
      ok: false,
      error: `Supera ${TOPE_HORAS_DIA} h tras agregar el turno (${total} h con preview).`,
      horas: total,
    };
  }
  return { ok: true, horas: total };
}

/**
 * @param {{
 *   capa: unknown;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaYmd: string;
 *   turnosPorId?: Record<string, object>;
 * }} params
 */
export function turnosAdicionablesEnDia(params) {
  const {
    capa,
    opsPendientes = [],
    personaId,
    fechaYmd,
    turnosPorId = {},
  } = params;
  const preview = proyectarDiaConOpsPendientes(
    capa,
    opsPendientes,
    personaId,
    fechaYmd,
    turnosPorId,
  );
  const presentes = new Set(preview.segmentoIds.map(String));
  const out = [];
  for (const id of Object.keys(turnosPorId)) {
    const cn1 = validarAdicionalCN1(id, capa, preview.segmentoIds, turnosPorId);
    if (!cn1.ok) continue;
    const tope = validarTopeHorasPostAdicional(
      preview.horas,
      id,
      turnosPorId,
      preview.segmentosCapa,
    );
    if (!tope.ok) continue;
    out.push({
      turno_id: id,
      meta: turnosPorId[id] || {},
      ya_presente: presentes.has(id),
    });
  }
  return { opciones: out, preview };
}

/**
 * @param {{
 *   turnoId: string;
 *   capa: unknown;
 *   personaId: string;
 *   fechaYmd: string;
 *   periodo?: string;
 *   turnosPorId?: Record<string, object>;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   motivo?: string;
 *   modoDeclaracion?: "extra" | "preasignado";
 * }} params
 */
export function validarAdicionalTurno(params) {
  const {
    turnoId,
    capa,
    personaId,
    fechaYmd,
    periodo = "",
    turnosPorId = {},
    opsPendientes = [],
    motivo = "",
    modoDeclaracion = "extra",
  } = params;

  const tid = String(turnoId || "").trim();
  const motivoTrim = String(motivo || "").trim();
  if (motivoTrim.length < 3) {
    return { ok: false, error: "Motivo obligatorio (mín. 3 caracteres)." };
  }
  if (!tid) {
    return { ok: false, error: "Elegí el turno adicional del régimen." };
  }
  if (!turnosPorId[tid]) {
    return { ok: false, error: "El turno elegido no pertenece al régimen horario del agente." };
  }

  const f = String(fechaYmd || "").trim();
  const mes = String(periodo || "").trim();
  if (mes && f && f.slice(0, 7) !== mes) {
    return { ok: false, error: "La fecha debe estar en el mismo mes del período." };
  }

  const preview = proyectarDiaConOpsPendientes(
    capa,
    opsPendientes,
    personaId,
    f,
    turnosPorId,
  );

  const estadoPrevioBase = capturarEstadoPrevioDia(capa, turnosPorId, preview);
  const esPreasignado = modoDeclaracion === "preasignado";

  if (esPreasignado) {
    const preasignados = (estadoPrevioBase.segmentos_preasignados || []).map(String);
    if (!preasignados.includes(tid)) {
      const lbl = etiquetaSegmentosCompuesto([tid], turnosPorId);
      return {
        ok: false,
        error: `${lbl} no figura en el turno preasignado de este día.`,
      };
    }
  } else {
    const cn1 = validarAdicionalCN1(tid, capa, preview.segmentoIds, turnosPorId);
    if (!cn1.ok) return cn1;
    const tope = validarTopeHorasPostAdicional(
      preview.horas,
      tid,
      turnosPorId,
      preview.segmentosCapa,
    );
    if (!tope.ok) return tope;
  }

  const estadoPrevio = {
    ...estadoPrevioBase,
    declaracion_tramo_preasignado: esPreasignado,
    tramo_declarado_id: esPreasignado ? tid : null,
  };

  return {
    ok: true,
    turnoId: tid,
    modoDeclaracion: esPreasignado ? "preasignado" : "extra",
    estadoPrevio,
    preview,
    etiquetaTeorico: estadoPrevio.etiqueta_preasignada
      || (estadoPrevio.es_franco ? "Franco" : estadoPrevio.es_no_laborable ? "No laborable" : "—"),
    etiquetaAdicional: esPreasignado
      ? etiquetaSegmentosCompuesto([tid], turnosPorId)
      : `+ ${etiquetaSegmentosCompuesto([tid], turnosPorId)}`,
  };
}

/**
 * @param {Record<string, unknown>} op
 */
export function esAdicionalV2(op) {
  return (
    op?.tipo === "adicional"
    && Boolean(String(op.personaId || op.persona_id || "").trim())
    && Boolean(String(op.fechaYmd || op.fecha || "").trim())
    && Boolean(String(op.turnoId || op.turno_id || "").trim())
    && String(op.motivo || "").trim().length >= 3
    && op?.estadoPrevio != null
  );
}

/**
 * Outbox Flujo C — RFC §3.3 (snapshot declarativo; trámite C-WORKFLOW: RRHH → jefe superior).
 * @param {{
 *   id?: string;
 *   personaId: string;
 *   fechaYmd: string;
 *   turnoId: string;
 *   motivo: string;
 *   expectedVersionToken: string;
 *   grupoId: string;
 *   periodo: string;
 *   personaLabel?: string;
 *   grupoLabel?: string;
 *   estadoPrevio: ReturnType<typeof capturarEstadoPrevioDia>;
 *   creado_en?: string;
 *   esUrgenciaOperativa?: boolean;
 * }} params
 */
export function buildAdicionalOutboxOp(params) {
  const turnoId = String(params.turnoId || "").trim();
  const estadoPrevio = params.estadoPrevio || {};

  return {
    id: params.id,
    creado_en: params.creado_en,
    tipo: "adicional",
    personaId: params.personaId,
    personaLabel: String(params.personaLabel || "").trim(),
    fechaYmd: params.fechaYmd,
    turnoId,
    turno_id: turnoId,
    turnoIdAdicional: turnoId,
    motivo: String(params.motivo || "").trim(),
    expectedVersionToken: String(params.expectedVersionToken || "").trim(),
    grupoId: params.grupoId,
    periodo: params.periodo,
    grupoLabel: String(params.grupoLabel || "").trim(),
    estadoPrevio,
    esFeriado: estadoPrevio.es_feriado === true,
    esUrgenciaOperativa: params.esUrgenciaOperativa === true,
  };
}

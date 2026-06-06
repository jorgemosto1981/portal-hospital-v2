"use strict";

/**
 * Callables para gestión de overrides puntuales en asistencia_diaria.
 *
 * Override = cambio operativo diario que diverge del turno teórico:
 *   - "reemplazo": sustituye el turno teórico (ej. cambio de franco).
 *   - "adicional": se suma al turno teórico (ej. doble guardia de urgencia).
 *
 * Se almacena en asistencia_diaria.overrides_turno[] como array.
 */

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../shared/context");
const runtimeFlags = require("../shared/runtimeFlags.json");
const { assertOverrideAuth } = require("../shared/helpers");
const { materializarTurnoTeoricoDia: materializarTurnoTeoricoDiaWorker } = require("./rdaTurnoTeoricoWorker");
const { assertGrillaGsoEscrituraEnFecha } = require("./grillaGsoSoloLectura");
const { buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const { obtenerCapaTeoricaDia } = require("./obtenerCapaTeoricaDia");
const {
  CFG_TOV_COBERTURA_PARCIAL,
  CFG_EPL_LIQUIDADO_CERRADO,
  seedIds,
} = require("../shared/cfgAsistenciaTurnosIds");
const { logger } = require("firebase-functions/v2");

const COL_ASISTENCIA = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PER_ID = /^per_[A-Z0-9]+$/i;
const GDT_ID = /^gdt_[A-Z0-9]+$/i;
const TIPOS_OVERRIDE = new Set(["reemplazo", "adicional", "cobertura_parcial"]);

const TCC_IDS = new Set(Object.values(seedIds.cfg_tipo_compensacion_cobertura || {}));

function err(code, msg) {
  throw new HttpsError(code, msg);
}

function resolveGrupoTrabajoId(data, ctx) {
  const fromCtx = ctx && typeof ctx === "object"
    ? String(ctx.grupo_id || ctx.grupo_trabajo_id || "").trim()
    : "";
  const direct = data && typeof data === "object"
    ? String(data.grupo_trabajo_id || data.grupo_id || "").trim()
    : "";
  return fromCtx || direct;
}

function requireGrupoTrabajoId(value, code) {
  const gdt = String(value || "").trim();
  if (!GDT_ID.test(gdt)) err("invalid-argument", code);
  return gdt;
}

function docIdAsistencia(personaId, fechaYmd) {
  return `asi_${personaId}_${fechaYmd.replace(/-/g, "")}`;
}

function validarInput(data) {
  if (!data || typeof data !== "object") err("invalid-argument", "[OVR-001] datos requeridos.");

  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
  if (!personaId) err("invalid-argument", "[OVR-002] persona_id requerido.");

  const fecha = typeof data.fecha === "string" ? data.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", "[OVR-003] fecha YYYY-MM-DD requerida.");

  return { personaId, fecha };
}

function esCoberturaParcial(ov) {
  const tipoOvId = typeof ov.tipo_override_id === "string" ? ov.tipo_override_id.trim() : "";
  const tipo = typeof ov.tipo === "string" ? ov.tipo.trim() : "";
  return tipoOvId === CFG_TOV_COBERTURA_PARCIAL || tipo === "cobertura_parcial";
}

function validarOverrideCobertura(ov) {
  const motivo = typeof ov.motivo === "string" ? ov.motivo.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-012] motivo requerido (mín. 3 caracteres).");

  const tipo_compensacion_id = typeof ov.tipo_compensacion_id === "string"
    ? ov.tipo_compensacion_id.trim() : "";
  if (!TCC_IDS.has(tipo_compensacion_id)) {
    err("invalid-argument", "[OVR-020] tipo_compensacion_id cfg_tcc_* requerido.");
  }

  const persona_origen_id = typeof ov.persona_origen_id === "string" ? ov.persona_origen_id.trim() : "";
  const persona_cobertura_id = typeof ov.persona_cobertura_id === "string" ? ov.persona_cobertura_id.trim() : "";
  if (!PER_ID.test(persona_origen_id)) err("invalid-argument", "[OVR-021] persona_origen_id requerido.");
  if (!PER_ID.test(persona_cobertura_id)) err("invalid-argument", "[OVR-022] persona_cobertura_id requerido.");

  const segmentos = Array.isArray(ov.segmentos_cubiertos) ? ov.segmentos_cubiertos : [];
  if (segmentos.length < 1) err("invalid-argument", "[OVR-023] segmentos_cubiertos (≥1) requerido.");

  return {
    tipo: "cobertura_parcial",
    tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
    tipo_compensacion_id,
    persona_origen_id,
    persona_cobertura_id,
    segmentos_cubiertos: segmentos.map(String),
    motivo,
  };
}

function validarOverride(ov) {
  if (!ov || typeof ov !== "object") err("invalid-argument", "[OVR-010] override requerido.");

  if (esCoberturaParcial(ov)) return validarOverrideCobertura(ov);

  const tipo = typeof ov.tipo === "string" ? ov.tipo.trim() : "";
  if (!TIPOS_OVERRIDE.has(tipo) || tipo === "cobertura_parcial") {
    err("invalid-argument", "[OVR-011] tipo debe ser 'reemplazo' o 'adicional'.");
  }

  const motivo = typeof ov.motivo === "string" ? ov.motivo.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-012] motivo requerido (mín. 3 caracteres).");

  const ingreso = typeof ov.ingreso === "string" && HH_MM.test(ov.ingreso) ? ov.ingreso : null;
  const egreso = typeof ov.egreso === "string" && HH_MM.test(ov.egreso) ? ov.egreso : null;
  const horas_efectivas = typeof ov.horas_efectivas === "number" && ov.horas_efectivas >= 0 && ov.horas_efectivas <= 24
    ? ov.horas_efectivas : null;
  const turno_id = typeof ov.turno_id === "string" && ov.turno_id.trim() ? ov.turno_id.trim() : null;

  return { tipo, ingreso, egreso, horas_efectivas, turno_id, motivo };
}

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function readVisVersionToken(visData) {
  if (!visData || typeof visData !== "object") return null;
  const meta = visData.metadata || {};
  return tsToIso(meta.version_token) || tsToIso(meta.ultima_sync_teorica);
}

async function assertConcurrenciaVis(personaId, fecha, tokenEsperado, grupoId) {
  const esperado = typeof tokenEsperado === "string" ? tokenEsperado.trim() : "";
  if (!esperado) return;
  const gdt = requireGrupoTrabajoId(grupoId, "[OVR-030] grupo_trabajo_id (gdt_*) requerido para concurrencia.");
  const visId = buildVisDocumentId(personaId, fecha, gdt);
  const snap = await db.collection(COL_VIS).doc(visId).get();
  const actual = snap.exists ? readVisVersionToken(snap.data()) : null;
  if (actual !== esperado) {
    err(
      "failed-precondition",
      "[ASI-CONC-001] La información en pantalla está desactualizada. Por favor, recargue la grilla.",
    );
  }
}

async function assertPeriodoEditable(personaId, fecha, grupoId, token) {
  try {
    await assertGrillaGsoEscrituraEnFecha(db, personaId, fecha, grupoId, token);
  } catch (e) {
    const code = e && e.code === "failed-precondition" ? "failed-precondition" : "internal";
    err(code, (e && e.message) || "[ASI-PER-001] Período no editable.");
  }
}

/**
 * T-04: rematerializa solo el día afectado (origen + cobertura) en el gdt.
 * Evita recalcular el mes completo por cada operación puntual.
 */
async function materializarDiaAfectado({ override, personaId, fechaYmd, grupoId, logTag = "post_override" }) {
  const gdt = requireGrupoTrabajoId(grupoId, "[OVR-031] grupo_trabajo_id (gdt_*) requerido para rematerializar.");
  const personas = new Set([personaId]);
  const ov = override && typeof override === "object" ? override : {};
  if (ov.persona_origen_id) personas.add(String(ov.persona_origen_id));
  if (ov.persona_cobertura_id) personas.add(String(ov.persona_cobertura_id));

  for (const pid of personas) {
    try {
      await materializarTurnoTeoricoDiaWorker({ personaId: pid, grupoId: gdt, fechaYmd });
      logger.info(`materializarTurnoTeoricoDia_${logTag} OK`, {
        personaId: pid, fecha: fechaYmd, grupoId: gdt,
      });
    } catch (e) {
      logger.error(`materializarTurnoTeoricoDia_${logTag} ERROR`, {
        personaId: pid, fecha: fechaYmd, grupoId: gdt, error: String(e),
      });
    }
  }
}

function payloadCoberturaDesdeOp(op) {
  const src = op && typeof op === "object" ? (op.payload && typeof op.payload === "object" ? op.payload : op) : {};
  return {
    persona_origen_id: src.persona_origen_id,
    persona_cobertura_id: src.persona_cobertura_id,
    fecha: src.fecha,
    segmentos_cubiertos: src.segmentos_cubiertos,
    tipo_compensacion_id: src.tipo_compensacion_id,
    motivo: src.motivo,
    tipo_override_id: src.tipo_override_id,
    tipo: src.tipo,
  };
}

function payloadSimpleOverrideDesdeOp(op) {
  const src = op && typeof op === "object" ? (op.payload && typeof op.payload === "object" ? op.payload : op) : {};
  return {
    persona_id: src.persona_id,
    fecha: src.fecha,
    tipo: src.tipo,
    ingreso: src.ingreso,
    egreso: src.egreso,
    horas_efectivas: src.horas_efectivas,
    horas_adicionales_solicitadas: src.horas_adicionales_solicitadas,
    turno_id: src.turno_id,
    turno_id_adicional: src.turno_id_adicional,
    motivo: src.motivo,
    estado_previo: src.estado_previo,
    es_feriado: src.es_feriado,
    fecha_origen: src.fecha_origen,
    fecha_destino: src.fecha_destino,
    segmentos_a_trasladar: src.segmentos_a_trasladar,
    segmentos_trasladar: src.segmentos_trasladar,
    segmentos_incorporados_destino: src.segmentos_incorporados_destino,
    franco_en_origen: src.franco_en_origen,
    origen: src.origen,
    destino: src.destino,
  };
}

/** @param {Record<string, unknown>} src */
function esPayloadCoberturaV2(src) {
  const o = src?.origen;
  const d = src?.destino;
  return Boolean(
    o && typeof o === "object"
    && d && typeof d === "object"
    && PER_ID.test(String(o.persona_id || "").trim())
    && PER_ID.test(String(d.persona_id || "").trim())
    && Array.isArray(o.segmentos_cedidos)
    && Array.isArray(d.segmentos_cedidos),
  );
}

/** @param {Record<string, unknown>} src */
function esPayloadReemplazoV2(src) {
  const fo = String(src?.fecha_origen || "").trim();
  const fd = String(src?.fecha_destino || "").trim();
  const segs = src?.segmentos_a_trasladar || src?.segmentos_trasladar;
  return YMD.test(fo) && YMD.test(fd) && Array.isArray(segs) && segs.length >= 1;
}

/** @param {Record<string, unknown>} src */
function esPayloadAdicionalV2(src) {
  const ep = src?.estado_previo;
  if (!ep || typeof ep !== "object") return false;
  const tid = String(src.turno_id_adicional || src.turno_id || "").trim();
  return Boolean(tid);
}

function validarOverrideAdicionalV2(raw) {
  const ov = raw && typeof raw === "object" ? raw : {};
  const motivo = typeof ov.motivo === "string" ? ov.motivo.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[C-BATCH-012] motivo requerido (mín. 3 caracteres).");

  const turno_id = String(ov.turno_id_adicional || ov.turno_id || "").trim();
  if (!turno_id) err("invalid-argument", "[C-BATCH-013] turno_id / turno_id_adicional requerido.");

  if (ov.horas_efectivas != null && ov.horas_efectivas !== "") {
    err("invalid-argument", "[C-BATCH-014] horas_efectivas no permitidas en alta jefe (Flujo C).");
  }
  if (ov.horas_adicionales_solicitadas != null && ov.horas_adicionales_solicitadas !== "") {
    err("invalid-argument", "[C-BATCH-015] horas_adicionales_solicitadas no permitidas en alta jefe.");
  }

  const ep = ov.estado_previo;
  if (!ep || typeof ep !== "object") {
    err("invalid-argument", "[C-BATCH-016] estado_previo requerido (snapshot §3.3).");
  }

  const estado_previo = {
    es_franco: ep.es_franco === true,
    es_feriado: ep.es_feriado === true,
    es_no_laborable: ep.es_no_laborable === true,
    tipo_dia: typeof ep.tipo_dia === "string" ? ep.tipo_dia.trim() : null,
    turno_preasignado_id: ep.turno_preasignado_id ? String(ep.turno_preasignado_id).trim() : null,
    segmentos_preasignados: Array.isArray(ep.segmentos_preasignados)
      ? ep.segmentos_preasignados.map(String)
      : [],
    etiqueta_preasignada: typeof ep.etiqueta_preasignada === "string"
      ? ep.etiqueta_preasignada.trim()
      : null,
    horas_preasignadas: Number.isFinite(Number(ep.horas_preasignadas))
      ? Math.max(0, Number(ep.horas_preasignadas))
      : 0,
  };

  return {
    tipo: "adicional",
    turno_id,
    motivo,
    estado_previo,
    es_feriado: ov.es_feriado === true || estado_previo.es_feriado === true,
  };
}

function validarPayloadReemplazoV2(payload, idx) {
  const persona_id = typeof payload.persona_id === "string" ? payload.persona_id.trim() : "";
  if (!PER_ID.test(persona_id)) {
    err("invalid-argument", `[B-BATCH-001] op[${idx}] persona_id requerido.`);
  }
  const fecha_origen = String(payload.fecha_origen || "").trim();
  const fecha_destino = String(payload.fecha_destino || "").trim();
  if (!YMD.test(fecha_origen) || !YMD.test(fecha_destino)) {
    err("invalid-argument", `[B-BATCH-002] op[${idx}] fecha_origen y fecha_destino YYYY-MM-DD requeridas.`);
  }
  const segs = payload.segmentos_a_trasladar || payload.segmentos_trasladar;
  const segmentos_a_trasladar = Array.isArray(segs)
    ? [...new Set(segs.map((x) => String(x).trim()).filter(Boolean))]
    : [];
  if (segmentos_a_trasladar.length < 1) {
    err("invalid-argument", `[B-BATCH-003] op[${idx}] segmentos_a_trasladar requerido (≥1).`);
  }
  const motivo = typeof payload.motivo === "string" ? payload.motivo.trim() : "";
  if (motivo.length < 3) {
    err("invalid-argument", `[B-BATCH-004] op[${idx}] motivo requerido (mín. 3 caracteres).`);
  }
  let segmentos_incorporados_destino = Array.isArray(payload.segmentos_incorporados_destino)
    ? [...new Set(payload.segmentos_incorporados_destino.map((x) => String(x).trim()).filter(Boolean))]
    : [];
  if (!segmentos_incorporados_destino.length) {
    const tid = String(payload.turno_id || payload.turno_id_destino || "").trim();
    if (tid) segmentos_incorporados_destino = segmentos_a_trasladar.map(() => tid);
  }
  if (segmentos_incorporados_destino.length !== segmentos_a_trasladar.length) {
    err(
      "invalid-argument",
      `[B-BATCH-005] op[${idx}] segmentos_incorporados_destino debe tener la misma cantidad que segmentos_a_trasladar.`,
    );
  }
  const turno_id_destino = String(
    payload.turno_id || payload.turno_id_destino || segmentos_incorporados_destino[0] || "",
  ).trim();
  if (!turno_id_destino) {
    err("invalid-argument", `[B-BATCH-006] op[${idx}] turno_id / turno_id_destino requerido.`);
  }
  const mismoConjunto = segmentos_a_trasladar.every(
    (id, i) => id === segmentos_incorporados_destino[i],
  );
  if (fecha_origen === fecha_destino && mismoConjunto) {
    err("invalid-argument", `[B-BATCH-007] op[${idx}] traslado intra-día sin cambio neto (noop).`);
  }
  return {
    persona_id,
    fecha_origen,
    fecha_destino,
    segmentos_a_trasladar,
    segmentos_incorporados_destino,
    turno_id_destino,
    franco_en_origen: payload.franco_en_origen === true,
    motivo,
  };
}

/**
 * B-BATCH-1: una op outbox → dos ítems (origen + destino), mismo op_id.
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeBatchOpReemplazoV2(op, idx, grupo_trabajo_id, expectedDestino) {
  const payload = payloadSimpleOverrideDesdeOp(op);
  const v = validarPayloadReemplazoV2(payload, idx);
  const op_id = String(op.id || `op_${idx + 1}`);
  const ctxConc = op.concurrencia && typeof op.concurrencia === "object" ? op.concurrencia : {};
  const expectedOrigen = typeof ctxConc.expected_version_token_origen === "string"
    ? ctxConc.expected_version_token_origen.trim()
    : expectedDestino;

  const overrideOrigen = {
    tipo: "reemplazo",
    motivo: v.motivo,
    reemplazo_traslado_v2: "origen",
    fecha_origen: v.fecha_origen,
    fecha_destino: v.fecha_destino,
    segmentos_a_trasladar: v.segmentos_a_trasladar,
    franco_en_origen: v.franco_en_origen,
    turno_id: null,
    ...(v.franco_en_origen ? { tipo_dia: "franco" } : {}),
  };
  const overrideDestino = {
    tipo: "reemplazo",
    motivo: v.motivo,
    reemplazo_traslado_v2: "destino",
    fecha_origen: v.fecha_origen,
    fecha_destino: v.fecha_destino,
    turno_id: v.turno_id_destino,
    segmentos_incorporados_destino: v.segmentos_incorporados_destino,
  };

  return [
    {
      op_id,
      tipo: "reemplazo",
      fecha: v.fecha_origen,
      grupo_trabajo_id,
      expected_version_token: expectedOrigen,
      persona_id: v.persona_id,
      override: overrideOrigen,
      batch_leg: "traslado_origen",
    },
    {
      op_id,
      tipo: "reemplazo",
      fecha: v.fecha_destino,
      grupo_trabajo_id,
      expected_version_token: expectedDestino,
      persona_id: v.persona_id,
      override: overrideDestino,
      batch_leg: "traslado_destino",
    },
  ];
}

function normalizeBatchOpAdicionalV2(op, idx, grupo_trabajo_id, expected) {
  const payload = payloadSimpleOverrideDesdeOp(op);
  const persona_id = typeof payload.persona_id === "string" ? payload.persona_id.trim() : "";
  if (!PER_ID.test(persona_id)) err("invalid-argument", `[BATCH-008] op[${idx}] persona_id requerido.`);
  const fecha = typeof payload.fecha === "string" ? payload.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", `[BATCH-004] op[${idx}] fecha YYYY-MM-DD requerida.`);
  const override = validarOverrideAdicionalV2(payload);
  return {
    op_id: String(op.id || `op_${idx + 1}`),
    tipo: "adicional",
    fecha,
    grupo_trabajo_id,
    expected_version_token: expected,
    persona_id,
    override,
  };
}

function validarPayloadCoberturaV2(src, idx, periodoCtx) {
  const o = src?.origen && typeof src.origen === "object" ? src.origen : null;
  const d = src?.destino && typeof src.destino === "object" ? src.destino : null;
  if (!o || !d) {
    err("invalid-argument", `[BATCH-A001] op[${idx}] origen y destino requeridos.`);
  }
  const persona_origen_id = String(o.persona_id || "").trim();
  const persona_cobertura_id = String(d.persona_id || "").trim();
  if (!PER_ID.test(persona_origen_id) || !PER_ID.test(persona_cobertura_id)) {
    err("invalid-argument", `[BATCH-A001] op[${idx}] persona_id per_* en origen y destino.`);
  }
  if (persona_origen_id === persona_cobertura_id) {
    err("invalid-argument", `[BATCH-A003] op[${idx}] intercambio requiere dos agentes distintos.`);
  }
  const fecha_origen = String(o.fecha || "").trim();
  const fecha_destino = String(d.fecha || "").trim();
  if (!YMD.test(fecha_origen) || !YMD.test(fecha_destino)) {
    err("invalid-argument", `[BATCH-A001] op[${idx}] fechas origen/destino YYYY-MM-DD requeridas.`);
  }
  const periodo = String(periodoCtx || "").trim();
  if (periodo && (fecha_origen.slice(0, 7) !== periodo || fecha_destino.slice(0, 7) !== periodo)) {
    err("invalid-argument", `[BATCH-A002] op[${idx}] fechas deben pertenecer a context.periodo.`);
  }
  const segmentos_cedidos_origen = Array.isArray(o.segmentos_cedidos)
    ? [...new Set(o.segmentos_cedidos.map((x) => String(x).trim()).filter(Boolean))]
    : [];
  const segmentos_cedidos_destino = Array.isArray(d.segmentos_cedidos)
    ? [...new Set(d.segmentos_cedidos.map((x) => String(x).trim()).filter(Boolean))]
    : [];
  if (segmentos_cedidos_origen.length < 1 || segmentos_cedidos_destino.length < 1) {
    err("invalid-argument", `[BATCH-A001] op[${idx}] segmentos_cedidos (≥1) en origen y destino.`);
  }
  const motivo = typeof src.motivo === "string" ? src.motivo.trim() : "";
  if (motivo.length < 3) {
    err("invalid-argument", `[BATCH-A004] op[${idx}] motivo requerido (mín. 3 caracteres).`);
  }
  const tipo_compensacion_id = typeof src.tipo_compensacion_id === "string"
    ? src.tipo_compensacion_id.trim()
    : "";
  if (!TCC_IDS.has(tipo_compensacion_id)) {
    err("invalid-argument", `[BATCH-A004] op[${idx}] tipo_compensacion_id cfg_tcc_* requerido.`);
  }
  return {
    persona_origen_id,
    persona_cobertura_id,
    fecha_origen,
    fecha_destino,
    segmentos_cedidos_origen,
    segmentos_cedidos_destino,
    motivo,
    tipo_compensacion_id,
  };
}

/**
 * A-BATCH: intercambio de guardia v2 (dos fechas, override duplicado en ambos asi_*).
 */
function normalizeBatchOpCoberturaV2(op, idx, grupo_trabajo_id, expectedOrigen) {
  const src = op.payload && typeof op.payload === "object" ? op.payload : op;
  const ctx = op.context && typeof op.context === "object" ? op.context : {};
  const conc = op.concurrencia && typeof op.concurrencia === "object" ? op.concurrencia : {};
  const expectedDestino = typeof conc.expected_version_token_destino === "string"
    ? conc.expected_version_token_destino.trim()
    : "";
  if (!expectedDestino) {
    err("invalid-argument", `[BATCH-A005] op[${idx}] expected_version_token_destino requerido en v2.`);
  }
  const v = validarPayloadCoberturaV2(src, idx, ctx.periodo);
  const override = {
    tipo: "cobertura_parcial",
    tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
    tipo_compensacion_id: v.tipo_compensacion_id,
    motivo: v.motivo,
    schema_version: 2,
    persona_origen_id: v.persona_origen_id,
    persona_cobertura_id: v.persona_cobertura_id,
    fecha_origen: v.fecha_origen,
    fecha_destino: v.fecha_destino,
    segmentos_cedidos_origen: v.segmentos_cedidos_origen,
    segmentos_cedidos_destino: v.segmentos_cedidos_destino,
    segmentos_cubiertos: v.segmentos_cedidos_origen,
  };
  return {
    op_id: String(op.id || `op_${idx + 1}`),
    tipo: "cobertura_parcial",
    schema_version: 2,
    fecha: v.fecha_origen,
    fecha_destino: v.fecha_destino,
    grupo_trabajo_id,
    expected_version_token: expectedOrigen,
    expected_version_token_destino: expectedDestino,
    persona_id: v.persona_origen_id,
    persona_origen_id: v.persona_origen_id,
    persona_cobertura_id: v.persona_cobertura_id,
    override,
  };
}

function normalizeBatchOpCobertura(op, idx, grupo_trabajo_id, expected) {
  const payload = payloadCoberturaDesdeOp(op);
  const fecha = typeof payload.fecha === "string" ? payload.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", `[BATCH-004] op[${idx}] fecha YYYY-MM-DD requerida.`);
  const override = validarOverrideCobertura(payload);
  return {
    op_id: String(op.id || `op_${idx + 1}`),
    tipo: "cobertura_parcial",
    fecha,
    grupo_trabajo_id,
    expected_version_token: expected,
    persona_id: override.persona_origen_id,
    persona_origen_id: override.persona_origen_id,
    persona_cobertura_id: override.persona_cobertura_id,
    override,
  };
}

function normalizeBatchOpSimple(op, idx, tipo, grupo_trabajo_id, expected) {
  const payload = payloadSimpleOverrideDesdeOp(op);
  payload.tipo = tipo;
  const persona_id = typeof payload.persona_id === "string" ? payload.persona_id.trim() : "";
  if (!PER_ID.test(persona_id)) err("invalid-argument", `[BATCH-008] op[${idx}] persona_id requerido.`);
  const fecha = typeof payload.fecha === "string" ? payload.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", `[BATCH-004] op[${idx}] fecha YYYY-MM-DD requerida.`);
  const override = validarOverride(payload);
  return {
    op_id: String(op.id || `op_${idx + 1}`),
    tipo,
    fecha,
    grupo_trabajo_id,
    expected_version_token: expected,
    persona_id,
    override,
  };
}

function normalizeBatchOp(raw, idx) {
  const op = raw && typeof raw === "object" ? raw : {};
  const tipo = String(op.tipo || op.payload?.tipo || "cobertura_parcial").trim();
  const ctx = op.context && typeof op.context === "object" ? op.context : {};
  const grupo_trabajo_id = requireGrupoTrabajoId(
    resolveGrupoTrabajoId(op, ctx),
    `[BATCH-007] op[${idx}] context.grupo_id (gdt_*) requerido.`,
  );
  const expected = typeof op?.concurrencia?.expected_version_token === "string"
    ? op.concurrencia.expected_version_token.trim()
    : "";
  if (!expected) {
    err("invalid-argument", `[BATCH-003] op[${idx}] expected_version_token requerido.`);
  }
  const payloadFlat = payloadSimpleOverrideDesdeOp(op);

  if (tipo === "cobertura_parcial") {
    if (esPayloadCoberturaV2(payloadFlat)) {
      return normalizeBatchOpCoberturaV2(op, idx, grupo_trabajo_id, expected);
    }
    return normalizeBatchOpCobertura(op, idx, grupo_trabajo_id, expected);
  }
  if (tipo === "reemplazo") {
    if (esPayloadReemplazoV2(payloadFlat)) {
      return normalizeBatchOpReemplazoV2(op, idx, grupo_trabajo_id, expected);
    }
    return normalizeBatchOpSimple(op, idx, tipo, grupo_trabajo_id, expected);
  }
  if (tipo === "adicional") {
    if (esPayloadAdicionalV2(payloadFlat)) {
      return normalizeBatchOpAdicionalV2(op, idx, grupo_trabajo_id, expected);
    }
    return normalizeBatchOpSimple(op, idx, tipo, grupo_trabajo_id, expected);
  }
  err("invalid-argument", `[BATCH-002] op[${idx}] tipo no soportado: ${tipo}`);
}

function personaIdsAfectadosPorOp(it) {
  if (it.tipo === "cobertura_parcial") {
    return [it.persona_origen_id, it.persona_cobertura_id];
  }
  return [it.persona_id];
}

function personaIdDocAsi(it) {
  return it.tipo === "cobertura_parcial" ? it.persona_origen_id : it.persona_id;
}

function personaIdConcurrencia(it) {
  return it.tipo === "cobertura_parcial" ? it.persona_origen_id : it.persona_id;
}

function esBatchItemCoberturaV2(it) {
  return it.tipo === "cobertura_parcial" && it.schema_version === 2 && YMD.test(String(it.fecha_destino || ""));
}

function clavesVisBatchItem(it) {
  if (esBatchItemCoberturaV2(it)) {
    return [
      `${it.persona_origen_id}|${it.fecha}|${it.grupo_trabajo_id}`,
      `${it.persona_cobertura_id}|${it.fecha_destino}|${it.grupo_trabajo_id}`,
    ];
  }
  const out = [];
  for (const pid of personaIdsAfectadosPorOp(it)) {
    out.push(`${pid}|${it.fecha}|${it.grupo_trabajo_id}`);
  }
  return out;
}

function clavesAsiBatchItem(it) {
  if (esBatchItemCoberturaV2(it)) {
    return [
      `${it.persona_origen_id}|${it.fecha}`,
      `${it.persona_cobertura_id}|${it.fecha_destino}`,
    ];
  }
  return [`${personaIdDocAsi(it)}|${it.fecha}`];
}

function periodosBatchItem(it) {
  const meses = [it.fecha.slice(0, 7)];
  if (it.fecha_destino) meses.push(String(it.fecha_destino).slice(0, 7));
  return meses;
}

function visClosedByData(data) {
  const estado = data?.estado_periodo_liquidacion_id || null;
  return estado === CFG_EPL_LIQUIDADO_CERRADO;
}

async function rematerializarBatchOps(items) {
  const visto = new Set();
  for (const it of items) {
    const pares = esBatchItemCoberturaV2(it)
      ? [
        { personaId: it.persona_origen_id, fechaYmd: it.fecha },
        { personaId: it.persona_cobertura_id, fechaYmd: it.fecha_destino },
      ]
      : [{ personaId: personaIdDocAsi(it), fechaYmd: it.fecha }];
    for (const { personaId, fechaYmd } of pares) {
      const k = `${personaId}|${fechaYmd}|${it.grupo_trabajo_id}`;
      if (visto.has(k)) continue;
      visto.add(k);
      await materializarDiaAfectado({
        override: it.override,
        personaId,
        fechaYmd,
        grupoId: it.grupo_trabajo_id,
        logTag: "post_batch",
      });
    }
  }
}

/**
 * Registra un override puntual en asistencia_diaria.overrides_turno[].
 * Si el doc no existe lo crea con estructura mínima.
 */
const registrarCambioTurno = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);
  const grupoTrabajoId = requireGrupoTrabajoId(
    resolveGrupoTrabajoId(data, data.context),
    "[OVR-031] grupo_trabajo_id (gdt_*) requerido.",
  );
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);
  const token = (request.auth && request.auth.token) || {};
  await assertPeriodoEditable(personaId, fecha, grupoTrabajoId, token);
  const override = validarOverride(data.override);
  if (override.tipo === "cobertura_parcial") {
    await assertPeriodoEditable(override.persona_origen_id, fecha, grupoTrabajoId, token);
    await assertPeriodoEditable(override.persona_cobertura_id, fecha, grupoTrabajoId, token);
    const tokenConc = typeof data.expected_version_token === "string"
      ? data.expected_version_token.trim()
      : (typeof data.concurrencia_vis_sync === "string" ? data.concurrencia_vis_sync.trim() : "");
    await assertConcurrenciaVis(override.persona_origen_id, fecha, tokenConc, grupoTrabajoId);
  }

  const uid = (request.auth && request.auth.uid) || "system";

  const entry = {
    ...override,
    grupo_de_trabajo_id: grupoTrabajoId,
    es_override_manual: true,
    creado_por_uid: uid,
    creado_por_persona_id: token.persona_id || null,
    creado_en: new Date().toISOString(),
    invalidado_por_replanificacion: false,
  };

  const docId = docIdAsistencia(personaId, fecha);
  const ref = db.collection(COL_ASISTENCIA).doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    await ref.update({
      overrides_turno: FieldValue.arrayUnion(entry),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      persona_id: personaId,
      fecha: fecha,
      overrides_turno: [entry],
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  }

  const updated = await ref.get();
  const overrides = updated.exists && Array.isArray(updated.data().overrides_turno)
    ? updated.data().overrides_turno : [];

  await materializarDiaAfectado({
    override,
    personaId,
    fechaYmd: fecha,
    grupoId: grupoTrabajoId,
    logTag: "post_override",
  });

  return {
    ok: true,
    doc_id: docId,
    total_overrides: overrides.length,
    override_registrado: entry,
  };
});

/**
 * Elimina (marca como eliminado) un override por índice.
 * No borra físicamente: marca eliminado_en + motivo para auditoría.
 */
const eliminarCambioTurno = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);
  const grupoTrabajoId = requireGrupoTrabajoId(
    resolveGrupoTrabajoId(data, data.context),
    "[OVR-031] grupo_trabajo_id (gdt_*) requerido.",
  );
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);
  const tokenDel = (request.auth && request.auth.token) || {};
  await assertPeriodoEditable(personaId, fecha, grupoTrabajoId, tokenDel);

  const idx = typeof data.override_index === "number" ? data.override_index : -1;
  if (idx < 0) err("invalid-argument", "[OVR-DEL-001] override_index (>=0) requerido.");

  const motivo = typeof data.motivo_eliminacion === "string" ? data.motivo_eliminacion.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-DEL-002] motivo_eliminacion requerido (mín. 3 caracteres).");

  const uid = (request.auth && request.auth.uid) || "system";

  const docId = docIdAsistencia(personaId, fecha);
  const ref = db.collection(COL_ASISTENCIA).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[OVR-DEL-003] Documento de asistencia no encontrado.");

  const overrides = Array.isArray(snap.data().overrides_turno) ? [...snap.data().overrides_turno] : [];
  if (idx >= overrides.length) err("out-of-range", `[OVR-DEL-004] Índice ${idx} fuera de rango (${overrides.length} overrides).`);

  overrides[idx] = {
    ...overrides[idx],
    eliminado: true,
    eliminado_en: new Date().toISOString(),
    eliminado_por_uid: uid,
    eliminado_por_persona_id: tokenDel.persona_id || null,
    motivo_eliminacion: motivo,
  };

  await ref.update({
    overrides_turno: overrides,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const eliminado = overrides[idx];
  await materializarDiaAfectado({
    override: eliminado || {},
    personaId,
    fechaYmd: fecha,
    grupoId: grupoTrabajoId,
    logTag: "post_override",
  });

  return { ok: true, doc_id: docId, override_eliminado_index: idx };
});

/**
 * Lista overrides activos de un agente para una fecha.
 */
const listarOverridesTurno = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);

  const docId = docIdAsistencia(personaId, fecha);
  const snap = await db.collection(COL_ASISTENCIA).doc(docId).get();
  if (!snap.exists) return { items: [], doc_id: docId };

  const all = Array.isArray(snap.data().overrides_turno) ? snap.data().overrides_turno : [];
  const activos = all.filter((o) => !o.eliminado && !o.invalidado_por_replanificacion);

  return {
    items: activos,
    total: all.length,
    activos: activos.length,
    doc_id: docId,
  };
});

/**
 * Aplica un lote de cambios de asistencia en forma atómica.
 * Tipos: cobertura_parcial, reemplazo, adicional.
 */
const aplicarBatchAsistencia = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data || {};
  const opsRaw = Array.isArray(data.ops) ? data.ops : [];
  if (opsRaw.length < 1) err("invalid-argument", "[BATCH-001] ops[] requerido.");
  if (opsRaw.length > 50) err("invalid-argument", "[BATCH-005] Máximo 50 operaciones por batch.");

  const items = opsRaw.flatMap((op, i) => {
    const normalized = normalizeBatchOp(op, i);
    return Array.isArray(normalized) ? normalized : [normalized];
  });
  const uniquePeriodo = new Set();
  for (const it of items) {
    for (const m of periodosBatchItem(it)) uniquePeriodo.add(m);
  }
  if (uniquePeriodo.size > 1) err("invalid-argument", "[BATCH-006] Todas las operaciones deben ser del mismo período.");

  const uniquePersonas = new Set();
  for (const it of items) {
    for (const pid of personaIdsAfectadosPorOp(it)) uniquePersonas.add(pid);
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    for (const pid of uniquePersonas) {
      await assertOverrideAuth(request, pid);
    }
  }

  const token = (request.auth && request.auth.token) || {};

  for (const it of items) {
    if (esBatchItemCoberturaV2(it)) {
      await assertPeriodoEditable(it.persona_origen_id, it.fecha, it.grupo_trabajo_id, token);
      await assertPeriodoEditable(it.persona_cobertura_id, it.fecha_destino, it.grupo_trabajo_id, token);
    } else {
      for (const pid of personaIdsAfectadosPorOp(it)) {
        await assertPeriodoEditable(pid, it.fecha, it.grupo_trabajo_id, token);
      }
    }
  }

  const uid = (request.auth && request.auth.uid) || "system";
  const nowIso = new Date().toISOString();

  const txResult = await db.runTransaction(async (tx) => {
    const visMap = new Map();
    const visRefMap = new Map();
    const visKeySet = new Set();
    for (const it of items) {
      for (const key of clavesVisBatchItem(it)) visKeySet.add(key);
    }
    for (const key of visKeySet) {
      const [pid, fecha, gdt] = key.split("|");
      const visId = buildVisDocumentId(pid, fecha, gdt);
      const ref = db.collection(COL_VIS).doc(visId);
      const snap = await tx.get(ref);
      visMap.set(key, snap);
      visRefMap.set(key, ref);
    }

    const asiMap = new Map();
    const asiRefMap = new Map();
    const asiKeySet = new Set();
    for (const it of items) {
      for (const key of clavesAsiBatchItem(it)) asiKeySet.add(key);
    }
    for (const key of asiKeySet) {
      const [pid, fecha] = key.split("|");
      const docId = docIdAsistencia(pid, fecha);
      const ref = db.collection(COL_ASISTENCIA).doc(docId);
      const snap = await tx.get(ref);
      asiMap.set(key, snap);
      asiRefMap.set(key, ref);
    }

    // Validaciones transaccionales (token + freeze)
    for (const it of items) {
      if (esBatchItemCoberturaV2(it)) {
        const visOrig = visMap.get(`${it.persona_origen_id}|${it.fecha}|${it.grupo_trabajo_id}`);
        const tokOrig = visOrig?.exists ? readVisVersionToken(visOrig.data()) : null;
        if (tokOrig !== it.expected_version_token) {
          err(
            "failed-precondition",
            "[ASI-CONC-001] La información en pantalla está desactualizada. Por favor, recargue la grilla.",
          );
        }
        const visDest = visMap.get(`${it.persona_cobertura_id}|${it.fecha_destino}|${it.grupo_trabajo_id}`);
        const tokDest = visDest?.exists ? readVisVersionToken(visDest.data()) : null;
        if (tokDest !== it.expected_version_token_destino) {
          err(
            "failed-precondition",
            "[ASI-CONC-001] La información en pantalla está desactualizada. Por favor, recargue la grilla.",
          );
        }
        if (visClosedByData(visOrig?.data()) || visClosedByData(visDest?.data())) {
          err("failed-precondition", "[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
        }
        continue;
      }

      const concPersona = personaIdConcurrencia(it);
      const visOrigen = visMap.get(`${concPersona}|${it.fecha}|${it.grupo_trabajo_id}`);
      const actualToken = visOrigen?.exists ? readVisVersionToken(visOrigen.data()) : null;
      if (actualToken !== it.expected_version_token) {
        err(
          "failed-precondition",
          "[ASI-CONC-001] La información en pantalla está desactualizada. Por favor, recargue la grilla.",
        );
      }

      if (it.tipo === "cobertura_parcial") {
        const visY = visMap.get(`${it.persona_cobertura_id}|${it.fecha}|${it.grupo_trabajo_id}`);
        if (visClosedByData(visOrigen?.data()) || visClosedByData(visY?.data())) {
          err("failed-precondition", "[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
        }
      } else if (visClosedByData(visOrigen?.data())) {
        err("failed-precondition", "[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
      }
    }

    // Escrituras asistencia_diaria
    const appendMap = new Map();
    const pushEntry = (asiKey, entry) => {
      const list = appendMap.get(asiKey) || [];
      list.push(entry);
      appendMap.set(asiKey, list);
    };
    for (const it of items) {
      const entry = {
        ...it.override,
        grupo_de_trabajo_id: it.grupo_trabajo_id,
        es_override_manual: true,
        creado_por_uid: uid,
        creado_por_persona_id: token.persona_id || null,
        creado_en: nowIso,
        invalidado_por_replanificacion: false,
        op_batch_id: it.op_id,
      };
      if (esBatchItemCoberturaV2(it)) {
        pushEntry(`${it.persona_origen_id}|${it.fecha}`, entry);
        pushEntry(`${it.persona_cobertura_id}|${it.fecha_destino}`, entry);
      } else {
        pushEntry(`${personaIdDocAsi(it)}|${it.fecha}`, entry);
      }
    }

    for (const [key, extra] of appendMap.entries()) {
      const snap = asiMap.get(key);
      const ref = asiRefMap.get(key);
      const [pid, fecha] = key.split("|");
      if (snap?.exists) {
        const current = Array.isArray(snap.data()?.overrides_turno) ? snap.data().overrides_turno : [];
        tx.update(ref, {
          overrides_turno: [...current, ...extra],
          actualizado_en: FieldValue.serverTimestamp(),
        });
      } else {
        tx.set(ref, {
          persona_id: pid,
          fecha,
          overrides_turno: extra,
          creado_en: FieldValue.serverTimestamp(),
          actualizado_en: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    // Bump token de versión en vis_* afectados
    for (const ref of visRefMap.values()) {
      tx.set(ref, {
        metadata: {
          version_token: FieldValue.serverTimestamp(),
          ultima_sync_teorica: FieldValue.serverTimestamp(),
        },
      }, { merge: true });
    }

    return { aplicadas: items.length };
  });

  await rematerializarBatchOps(items);
  return {
    ok: true,
    aplicadas: txResult.aplicadas,
    periodo: [...uniquePeriodo][0],
  };
});

const MAX_CONSULTAS_GESTION_TURNO = 20;

/**
 * Append consulta ligera al abrir grilla (RFC F4 amendment visual §5.2).
 */
const registrarConsultaGestionTurnoGrilla = onCall({
  invoker: "public",
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  const data = request.data || {};
  const { personaId, fecha } = validarInput(data);
  const grupoTrabajoId = requireGrupoTrabajoId(
    resolveGrupoTrabajoId(data, data.context),
    "[CONS-001] grupo_trabajo_id (gdt_*) requerido.",
  );
  const overrideRefs = Array.isArray(data.override_refs)
    ? data.override_refs.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (overrideRefs.length < 1) {
    return { ok: true, skipped: true, reason: "sin_overrides" };
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    await assertOverrideAuth(request, personaId);
  }

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};
  const opBatchIds = Array.isArray(data.op_batch_ids)
    ? [...new Set(data.op_batch_ids.map((x) => String(x).trim()).filter(Boolean))]
    : [];

  const entry = {
    consultado_en: new Date().toISOString(),
    consultado_por_persona_id: token.persona_id || null,
    consultado_por_uid: uid,
    grupo_trabajo_id: grupoTrabajoId,
    override_refs: overrideRefs,
    op_batch_ids: opBatchIds,
  };

  const docId = docIdAsistencia(personaId, fecha);
  const ref = db.collection(COL_ASISTENCIA).doc(docId);
  const snap = await ref.get();
  const prev = snap.exists && Array.isArray(snap.data()?.consultas_gestion_turno)
    ? snap.data().consultas_gestion_turno
    : [];
  const next = [...prev, entry].slice(-MAX_CONSULTAS_GESTION_TURNO);

  if (snap.exists) {
    await ref.update({
      consultas_gestion_turno: next,
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      persona_id: personaId,
      fecha,
      consultas_gestion_turno: next,
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return { ok: true, doc_id: docId, consultas: next.length };
});

/**
 * Materializa capa teórica de un solo día (celda GSO). F-UX.3 gate.
 */
const materializarTurnoTeoricoDia = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data || {};
  const { personaId, fecha } = validarInput(data);
  const grupoTrabajoId = requireGrupoTrabajoId(
    resolveGrupoTrabajoId(data, data.context),
    "[MAT-001] grupo_trabajo_id (gdt_*) requerido.",
  );
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);
  const token = (request.auth && request.auth.token) || {};
  await assertPeriodoEditable(personaId, fecha, grupoTrabajoId, token);

  const result = await materializarTurnoTeoricoDiaWorker({
    personaId,
    grupoId: grupoTrabajoId,
    fechaYmd: fecha,
  });
  if (!result?.ok) {
    err(
      "failed-precondition",
      result?.error || "[MAT-002] No se pudo calcular el turno de este día. Revise plan y régimen.",
    );
  }
  return {
    ok: true,
    persona_id: personaId,
    fecha,
    grupo_trabajo_id: grupoTrabajoId,
    dias_procesados: result.diasProcesados ?? 1,
  };
});

module.exports = {
  registrarCambioTurno,
  eliminarCambioTurno,
  listarOverridesTurno,
  registrarConsultaGestionTurnoGrilla,
  aplicarBatchAsistencia,
  obtenerCapaTeoricaDia,
  materializarTurnoTeoricoDia,
  normalizeBatchOp,
  esPayloadAdicionalV2,
  esPayloadReemplazoV2,
  esPayloadCoberturaV2,
};

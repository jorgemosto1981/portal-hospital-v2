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
const { materializarTurnoTeoricoDia } = require("./rdaTurnoTeoricoWorker");
const { assertPeriodoNoCerrado } = require("./asistenciaPeriodoLiquidacion");
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

async function assertPeriodoEditable(personaId, fecha, grupoId) {
  try {
    await assertPeriodoNoCerrado(personaId, fecha, grupoId);
  } catch (e) {
    const code = e && e.code === "failed-precondition" ? "failed-precondition" : "internal";
    err(code, (e && e.message) || "[ASI-PER-001] Período cerrado.");
  }
}

async function rematerializarTrasOverride(override, personaId, fecha, grupoId) {
  const gdt = requireGrupoTrabajoId(grupoId, "[OVR-031] grupo_trabajo_id (gdt_*) requerido para rematerializar.");
  const personas = new Set([personaId]);
  if (override.persona_origen_id) personas.add(override.persona_origen_id);
  if (override.persona_cobertura_id) personas.add(override.persona_cobertura_id);

  for (const pid of personas) {
    try {
      await materializarTurnoTeoricoDia({ personaId: pid, grupoId: gdt, fechaYmd: fecha });
      logger.info("materializarTurnoTeoricoDia_post_override OK", { personaId: pid, fecha, grupoId: gdt });
    } catch (e) {
      logger.error("materializarTurnoTeoricoDia_post_override ERROR", {
        personaId: pid, fecha, grupoId: gdt, error: String(e),
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

function normalizeBatchOp(raw, idx) {
  const op = raw && typeof raw === "object" ? raw : {};
  const tipo = String(op.tipo || op.payload?.tipo || "cobertura_parcial").trim();
  if (tipo !== "cobertura_parcial") {
    err("invalid-argument", `[BATCH-002] op[${idx}] tipo no soportado: ${tipo}`);
  }
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
  const payload = payloadCoberturaDesdeOp(op);
  const fecha = typeof payload.fecha === "string" ? payload.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", `[BATCH-004] op[${idx}] fecha YYYY-MM-DD requerida.`);
  const override = validarOverrideCobertura(payload);
  return {
    op_id: String(op.id || `op_${idx + 1}`),
    fecha,
    grupo_trabajo_id,
    expected_version_token: expected,
    persona_origen_id: override.persona_origen_id,
    persona_cobertura_id: override.persona_cobertura_id,
    override,
  };
}

function visClosedByData(data) {
  const estado = data?.estado_periodo_liquidacion_id || null;
  return estado === CFG_EPL_LIQUIDADO_CERRADO;
}

async function rematerializarBatchOps(items) {
  const unique = new Map();
  for (const it of items) {
    const fecha = it.fecha;
    const gdt = it.grupo_trabajo_id;
    unique.set(`${it.persona_origen_id}|${fecha}|${gdt}`, { personaId: it.persona_origen_id, fechaYmd: fecha, grupoId: gdt });
    unique.set(`${it.persona_cobertura_id}|${fecha}|${gdt}`, { personaId: it.persona_cobertura_id, fechaYmd: fecha, grupoId: gdt });
  }
  for (const obj of unique.values()) {
    try {
      await materializarTurnoTeoricoDia({ personaId: obj.personaId, grupoId: obj.grupoId, fechaYmd: obj.fechaYmd });
      logger.info("materializarTurnoTeoricoDia_post_batch OK", obj);
    } catch (e) {
      logger.error("materializarTurnoTeoricoDia_post_batch ERROR", { ...obj, error: String(e) });
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
  await assertPeriodoEditable(personaId, fecha, grupoTrabajoId);
  const override = validarOverride(data.override);
  if (override.tipo === "cobertura_parcial") {
    await assertPeriodoEditable(override.persona_origen_id, fecha, grupoTrabajoId);
    await assertPeriodoEditable(override.persona_cobertura_id, fecha, grupoTrabajoId);
    const tokenConc = typeof data.expected_version_token === "string"
      ? data.expected_version_token.trim()
      : (typeof data.concurrencia_vis_sync === "string" ? data.concurrencia_vis_sync.trim() : "");
    await assertConcurrenciaVis(override.persona_origen_id, fecha, tokenConc, grupoTrabajoId);
  }

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  const entry = {
    ...override,
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

  await rematerializarTrasOverride(override, personaId, fecha, grupoTrabajoId);

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
  await assertPeriodoEditable(personaId, fecha, grupoTrabajoId);

  const idx = typeof data.override_index === "number" ? data.override_index : -1;
  if (idx < 0) err("invalid-argument", "[OVR-DEL-001] override_index (>=0) requerido.");

  const motivo = typeof data.motivo_eliminacion === "string" ? data.motivo_eliminacion.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-DEL-002] motivo_eliminacion requerido (mín. 3 caracteres).");

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

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
    eliminado_por_persona_id: token.persona_id || null,
    motivo_eliminacion: motivo,
  };

  await ref.update({
    overrides_turno: overrides,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const eliminado = overrides[idx];
  await rematerializarTrasOverride(eliminado || {}, personaId, fecha, grupoTrabajoId);

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
 * MVP E2: soporta solo tipo cobertura_parcial.
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

  const items = opsRaw.map((op, i) => normalizeBatchOp(op, i));
  const uniquePeriodo = new Set(items.map((i) => i.fecha.slice(0, 7)));
  if (uniquePeriodo.size > 1) err("invalid-argument", "[BATCH-006] Todas las operaciones deben ser del mismo período.");

  const uniquePersonas = new Set();
  for (const it of items) {
    uniquePersonas.add(it.persona_origen_id);
    uniquePersonas.add(it.persona_cobertura_id);
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    for (const pid of uniquePersonas) {
      await assertOverrideAuth(request, pid);
    }
  }

  // Pre-flight check (rápido antes de abrir transacción)
  for (const it of items) {
    await assertPeriodoEditable(it.persona_origen_id, it.fecha, it.grupo_trabajo_id);
    await assertPeriodoEditable(it.persona_cobertura_id, it.fecha, it.grupo_trabajo_id);
  }

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};
  const nowIso = new Date().toISOString();

  const txResult = await db.runTransaction(async (tx) => {
    const visMap = new Map();
    const visRefMap = new Map();
    const visKeySet = new Set();
    for (const it of items) {
      visKeySet.add(`${it.persona_origen_id}|${it.fecha}|${it.grupo_trabajo_id}`);
      visKeySet.add(`${it.persona_cobertura_id}|${it.fecha}|${it.grupo_trabajo_id}`);
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
    const asiKeySet = new Set(items.map((it) => `${it.persona_origen_id}|${it.fecha}`));
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
      const visOrigen = visMap.get(`${it.persona_origen_id}|${it.fecha}|${it.grupo_trabajo_id}`);
      const actualToken = visOrigen?.exists ? readVisVersionToken(visOrigen.data()) : null;
      if (actualToken !== it.expected_version_token) {
        err(
          "failed-precondition",
          "[ASI-CONC-001] La información en pantalla está desactualizada. Por favor, recargue la grilla.",
        );
      }

      const visX = visMap.get(`${it.persona_origen_id}|${it.fecha}|${it.grupo_trabajo_id}`);
      const visY = visMap.get(`${it.persona_cobertura_id}|${it.fecha}|${it.grupo_trabajo_id}`);
      if (visClosedByData(visX?.data()) || visClosedByData(visY?.data())) {
        err("failed-precondition", "[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
      }
    }

    // Escrituras asistencia_diaria
    const appendMap = new Map();
    for (const it of items) {
      const key = `${it.persona_origen_id}|${it.fecha}`;
      const list = appendMap.get(key) || [];
      list.push({
        ...it.override,
        es_override_manual: true,
        creado_por_uid: uid,
        creado_por_persona_id: token.persona_id || null,
        creado_en: nowIso,
        invalidado_por_replanificacion: false,
        op_batch_id: it.op_id,
      });
      appendMap.set(key, list);
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

module.exports = {
  registrarCambioTurno,
  eliminarCambioTurno,
  listarOverridesTurno,
  aplicarBatchAsistencia,
  obtenerCapaTeoricaDia,
};

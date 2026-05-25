"use strict";

/**
 * Callables para gestión de planes de turno por servicio.
 * Máquina de estados: BORRADOR → ENVIADO → AUTORIZADO_SUPERIOR → HABILITADO
 * Rechazo en cualquier punto → BORRADOR.
 * Cerrado: HABILITADO → CERRADO (solo perpetuos).
 */

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../shared/context");
const runtimeFlags = require("../shared/runtimeFlags.json");
const { assertRrhh } = require("../shared/helpers");

const COL_PLANES = "planes_turno_servicio";
const COL_ASISTENCIA = "asistencia_diaria";

const ESTADOS_VALIDOS = new Set(["BORRADOR", "ENVIADO", "AUTORIZADO_SUPERIOR", "HABILITADO", "CERRADO"]);
const TIPOS_PLAN = new Set(["perpetuo", "mensual"]);

function err(code, msg) {
  throw new HttpsError(code, msg);
}

function assertEstado(doc, esperado) {
  const estado = doc.estado;
  if (estado !== esperado) {
    err("failed-precondition", `[PLT-EST] Estado actual '${estado}', se esperaba '${esperado}'.`);
  }
}

function assertEstados(doc, esperados) {
  if (!esperados.includes(doc.estado)) {
    err("failed-precondition", `[PLT-EST] Estado actual '${doc.estado}', se esperaba uno de: ${esperados.join(", ")}.`);
  }
}

function buildAprobacion(request, accion, observaciones) {
  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};
  return {
    actor_uid: uid,
    actor_persona_id: token.persona_id || null,
    fecha: new Date().toISOString().slice(0, 10),
    rol: token.portal_role || "rrhh",
    accion,
    observaciones: typeof observaciones === "string" ? observaciones.trim().slice(0, 500) || null : null,
  };
}

function validarDatosBase(datos) {
  if (!datos || typeof datos !== "object") err("invalid-argument", "[PLT-001] datos requeridos.");
  const grupoId = typeof datos.grupo_id === "string" ? datos.grupo_id.trim() : "";
  if (!grupoId) err("invalid-argument", "[PLT-002] grupo_id requerido.");
  const tipoPlan = typeof datos.tipo_plan === "string" ? datos.tipo_plan.trim() : "";
  if (!TIPOS_PLAN.has(tipoPlan)) err("invalid-argument", "[PLT-003] tipo_plan inválido (perpetuo o mensual).");
  if (!Array.isArray(datos.agentes) || datos.agentes.length === 0) {
    err("invalid-argument", "[PLT-004] Al menos un agente requerido.");
  }
  return { grupoId, tipoPlan };
}

function validarPlanMensual(datos) {
  const periodo = typeof datos.periodo === "string" ? datos.periodo.trim() : "";
  if (!/^\d{4}-\d{2}$/.test(periodo)) err("invalid-argument", "[PLT-005] periodo YYYY-MM requerido para plan mensual.");
  for (let i = 0; i < datos.agentes.length; i++) {
    const ag = datos.agentes[i];
    if (!ag.persona_id || !ag.regimen_horario_id || !ag.hlg_id) {
      err("invalid-argument", `[PLT-006] agentes[${i}]: persona_id, regimen_horario_id y hlg_id requeridos.`);
    }
    if (!ag.dias || typeof ag.dias !== "object") {
      err("invalid-argument", `[PLT-006] agentes[${i}]: dias (mapa YYYY-MM-DD) requerido.`);
    }
  }
  return { periodo };
}

function validarPlanPerpetuo(datos) {
  const vigente_desde = typeof datos.vigente_desde === "string" ? datos.vigente_desde.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigente_desde)) {
    err("invalid-argument", "[PLT-007] vigente_desde YYYY-MM-DD requerido para plan perpetuo.");
  }
  for (let i = 0; i < datos.agentes.length; i++) {
    const ag = datos.agentes[i];
    if (!ag.persona_id || !ag.regimen_horario_id || !ag.hlg_id) {
      err("invalid-argument", `[PLT-008] agentes[${i}]: persona_id, regimen_horario_id y hlg_id requeridos.`);
    }
  }
  return { vigente_desde, vigente_hasta: datos.vigente_hasta || null };
}

/**
 * Crea o actualiza un plan en estado BORRADOR.
 */
const guardarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const datos = request.data && request.data.datos;
  const { grupoId, tipoPlan } = validarDatosBase(datos);

  const now = FieldValue.serverTimestamp();
  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  let especificos;
  if (tipoPlan === "mensual") {
    const { periodo } = validarPlanMensual(datos);
    especificos = {
      tipo_plan: "mensual",
      periodo,
      agentes: datos.agentes.map((ag) => ({
        persona_id: ag.persona_id,
        regimen_horario_id: ag.regimen_horario_id,
        hlg_id: ag.hlg_id,
        dias: ag.dias,
      })),
    };
  } else {
    const { vigente_desde, vigente_hasta } = validarPlanPerpetuo(datos);
    especificos = {
      tipo_plan: "perpetuo",
      vigente_desde,
      vigente_hasta,
      agentes: datos.agentes.map((ag) => ({
        persona_id: ag.persona_id,
        regimen_horario_id: ag.regimen_horario_id,
        hlg_id: ag.hlg_id,
        regimen_fecha_ancla: ag.regimen_fecha_ancla || null,
      })),
    };
  }

  const existingId = request.data && request.data.id;
  let id;
  let exists = false;

  if (existingId && typeof existingId === "string") {
    id = existingId.trim();
    const snap = await db.collection(COL_PLANES).doc(id).get();
    if (snap.exists) {
      assertEstado(snap.data(), "BORRADOR");
      exists = true;
    }
  }

  if (!id) {
    const { ulid } = require("../../shared/utils/ulid.cjs");
    id = `plt_${ulid()}`;
  }

  const payload = {
    id,
    grupo_id: grupoId,
    estado: "BORRADOR",
    ...especificos,
    creado_por_uid: uid,
    creado_por_persona_id: token.persona_id || null,
    observaciones_rechazo: null,
    actualizado_en: now,
  };
  if (!exists) {
    payload.creado_en = now;
    payload.historial_aprobaciones = [];
  }

  await db.collection(COL_PLANES).doc(id).set(payload, { merge: true });
  return { ok: true, id, estado: "BORRADOR", modo: exists ? "actualizado" : "creado" };
});

/**
 * Jefe envía plan para aprobación: BORRADOR → ENVIADO.
 */
const enviarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  if (!planId) err("invalid-argument", "[PLT-ENV-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-ENV-002] Plan no encontrado.");

  const plan = snap.data();
  assertEstado(plan, "BORRADOR");

  const warnings = [];
  if (plan.tipo_plan === "mensual") {
    const regWarnings = await validarReglasContraRegimen(plan);
    warnings.push(...regWarnings);
  }

  const aprobacion = buildAprobacion(request, "enviar", null);
  await ref.update({
    estado: "ENVIADO",
    observaciones_rechazo: null,
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "ENVIADO", warnings };
});

/**
 * Superior aprueba: ENVIADO → AUTORIZADO_SUPERIOR.
 */
const aprobarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  if (!planId) err("invalid-argument", "[PLT-APR-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-APR-002] Plan no encontrado.");

  assertEstado(snap.data(), "ENVIADO");

  const obs = request.data && request.data.observaciones;
  const aprobacion = buildAprobacion(request, "aprobar", obs);
  await ref.update({
    estado: "AUTORIZADO_SUPERIOR",
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "AUTORIZADO_SUPERIOR" };
});

/**
 * Rechazar plan en cualquier estado (salvo HABILITADO) → BORRADOR.
 */
const rechazarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  const observaciones = request.data && request.data.observaciones;
  if (!planId) err("invalid-argument", "[PLT-REC-001] plan_id requerido.");
  if (!observaciones || typeof observaciones !== "string" || !observaciones.trim()) {
    err("invalid-argument", "[PLT-REC-002] Observaciones de rechazo requeridas.");
  }

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-REC-003] Plan no encontrado.");

  const plan = snap.data();
  assertEstados(plan, ["ENVIADO", "AUTORIZADO_SUPERIOR"]);

  const aprobacion = buildAprobacion(request, "rechazar", observaciones);
  await ref.update({
    estado: "BORRADOR",
    observaciones_rechazo: observaciones.trim().slice(0, 500),
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "BORRADOR" };
});

/**
 * RRHH habilita plan: AUTORIZADO_SUPERIOR → HABILITADO.
 * Detecta overrides fantasma y los invalida si se confirma.
 */
const habilitarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const planId = request.data && request.data.plan_id;
  const confirmarInvalidarOverrides = request.data && request.data.confirmar_invalidar_overrides === true;
  if (!planId) err("invalid-argument", "[PLT-HAB-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-HAB-002] Plan no encontrado.");

  const plan = snap.data();
  assertEstado(plan, "AUTORIZADO_SUPERIOR");

  const warnings = [];
  const overridesEncontrados = await detectarOverridesFantasma(plan);

  if (overridesEncontrados.length > 0 && !confirmarInvalidarOverrides) {
    return {
      ok: false,
      requiere_confirmacion: true,
      overrides_afectados: overridesEncontrados.length,
      detalle_overrides: overridesEncontrados.slice(0, 20),
      mensaje: `Existen ${overridesEncontrados.length} override(s) manual(es) en el período. Al habilitar, se invalidarán. Confirme con confirmar_invalidar_overrides: true.`,
    };
  }

  if (overridesEncontrados.length > 0 && confirmarInvalidarOverrides) {
    const invalidados = await invalidarOverridesFantasma(overridesEncontrados);
    warnings.push({
      code: "PLT-HAB-W001",
      mensaje: `Se invalidaron ${invalidados} override(s) por re-planificación.`,
    });
  }

  const aprobacion = buildAprobacion(request, "habilitar", null);
  await ref.update({
    estado: "HABILITADO",
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "HABILITADO", warnings };
});

/**
 * Cierra un plan perpetuo: HABILITADO → CERRADO (con fecha de cierre).
 */
const cerrarPlanPerpetuo = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const planId = request.data && request.data.plan_id;
  const fechaCierre = request.data && request.data.fecha_cierre;
  if (!planId) err("invalid-argument", "[PLT-CER-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-CER-002] Plan no encontrado.");

  const plan = snap.data();
  assertEstado(plan, "HABILITADO");

  if (plan.tipo_plan !== "perpetuo") {
    err("failed-precondition", "[PLT-CER-003] Solo planes perpetuos pueden cerrarse manualmente.");
  }

  const aprobacion = buildAprobacion(request, "cerrar", null);
  await ref.update({
    estado: "CERRADO",
    vigente_hasta: fechaCierre || new Date().toISOString().slice(0, 10),
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "CERRADO" };
});

/**
 * Lista planes de un grupo (con filtro opcional de estado/periodo).
 */
const listarPlanesTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const grupoId = request.data && request.data.grupo_id;
  if (!grupoId) err("invalid-argument", "[PLT-LIST-001] grupo_id requerido.");

  let q = db.collection(COL_PLANES).where("grupo_id", "==", grupoId);

  const estado = request.data && request.data.estado;
  if (estado && ESTADOS_VALIDOS.has(estado)) q = q.where("estado", "==", estado);

  const periodo = request.data && request.data.periodo;
  if (periodo) q = q.where("periodo", "==", periodo);

  const snap = await q.get();
  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { items };
});

// --- Helpers internos ---

async function validarReglasContraRegimen(plan) {
  const warnings = [];
  for (const ag of plan.agentes || []) {
    if (!ag.regimen_horario_id) continue;
    const regSnap = await db.collection("cfg_regimen_horario").doc(ag.regimen_horario_id).get();
    if (!regSnap.exists) continue;
    const reg = regSnap.data();
    if (reg.tipo_patron !== "planificado" || !reg.reglas_planificacion) continue;

    const reglas = reg.reglas_planificacion;
    const dias = ag.dias || {};
    const diasArr = Object.values(dias);
    const diasTrabajo = diasArr.filter((d) => d.tipo_dia === "laborable" || d.tipo_dia === "guardia").length;
    const diasFranco = diasArr.filter((d) => d.tipo_dia === "franco").length;

    if (reglas.dias_trabajo_max_mes != null && diasTrabajo > reglas.dias_trabajo_max_mes) {
      warnings.push({
        code: "PLT-REG-W001",
        persona_id: ag.persona_id,
        mensaje: `${diasTrabajo} días trabajo > máx. ${reglas.dias_trabajo_max_mes}.`,
      });
    }
    if (reglas.dias_franco_min_mes != null && diasFranco < reglas.dias_franco_min_mes) {
      warnings.push({
        code: "PLT-REG-W002",
        persona_id: ag.persona_id,
        mensaje: `${diasFranco} francos < mín. ${reglas.dias_franco_min_mes}.`,
      });
    }
  }
  return warnings;
}

async function detectarOverridesFantasma(plan) {
  const encontrados = [];
  const personaIds = (plan.agentes || []).map((a) => a.persona_id);

  let fechas = [];
  if (plan.tipo_plan === "mensual" && plan.periodo) {
    const [anio, mes] = plan.periodo.split("-").map(Number);
    const diasMes = new Date(anio, mes, 0).getDate();
    for (let d = 1; d <= diasMes; d++) {
      fechas.push(`${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  } else if (plan.tipo_plan === "perpetuo") {
    return [];
  }

  for (const pid of personaIds) {
    for (const f of fechas) {
      const docId = `asi_${pid}_${f.replace(/-/g, "")}`;
      const snap = await db.collection(COL_ASISTENCIA).doc(docId).get();
      if (!snap.exists) continue;
      const data = snap.data();
      const overrides = Array.isArray(data.overrides_turno) ? data.overrides_turno : [];
      const activos = overrides.filter((o) => !o.invalidado_por_replanificacion);
      if (activos.length > 0) {
        encontrados.push({ doc_id: docId, persona_id: pid, fecha: f, cantidad: activos.length });
      }
    }
  }

  return encontrados;
}

async function invalidarOverridesFantasma(overridesEncontrados) {
  let count = 0;
  for (const item of overridesEncontrados) {
    const ref = db.collection(COL_ASISTENCIA).doc(item.doc_id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data();
    const overrides = Array.isArray(data.overrides_turno) ? data.overrides_turno : [];
    const updated = overrides.map((o) => {
      if (o.invalidado_por_replanificacion) return o;
      count++;
      return { ...o, invalidado_por_replanificacion: true, invalidado_en: new Date().toISOString() };
    });
    await ref.update({ overrides_turno: updated, actualizado_en: FieldValue.serverTimestamp() });
  }
  return count;
}

module.exports = {
  guardarPlanTurnoServicio,
  enviarPlanTurnoServicio,
  aprobarPlanTurnoServicio,
  rechazarPlanTurnoServicio,
  habilitarPlanTurnoServicio,
  cerrarPlanPerpetuo,
  listarPlanesTurnoServicio,
};

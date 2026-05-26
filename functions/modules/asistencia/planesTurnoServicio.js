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
const { materializarGrupoMes } = require("./rdaTurnoTeoricoWorker");
const { logger } = require("firebase-functions/v2");

const COL_PLANES = "planes_turno_servicio";
const COL_ASISTENCIA = "asistencia_diaria";

const ESTADOS_VALIDOS = new Set(["BORRADOR", "ENVIADO", "HABILITADO", "EN_REVISION", "CERRADO"]);
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
    const { ulid } = require("ulid");
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
 * Jefe envía plan para aprobación: BORRADOR|EN_REVISION → ENVIADO.
 */
const enviarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  if (!planId) err("invalid-argument", "[PLT-ENV-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-ENV-002] Plan no encontrado.");

  const plan = snap.data();
  assertEstados(plan, ["BORRADOR", "EN_REVISION"]);

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
 * Superior (o RRHH en caso huérfano) aprueba: ENVIADO → HABILITADO.
 * Absorbe la lógica de materialización + overrides fantasma.
 */
const aprobarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  const confirmarInvalidarOverrides = request.data && request.data.confirmar_invalidar_overrides === true;
  if (!planId) err("invalid-argument", "[PLT-APR-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-APR-002] Plan no encontrado.");

  const plan = snap.data();
  assertEstado(plan, "ENVIADO");

  const warnings = [];
  const overridesEncontrados = await detectarOverridesFantasma(plan);

  if (overridesEncontrados.length > 0 && !confirmarInvalidarOverrides) {
    return {
      ok: false,
      requiere_confirmacion: true,
      overrides_afectados: overridesEncontrados.length,
      detalle_overrides: overridesEncontrados.slice(0, 20),
      mensaje: `Existen ${overridesEncontrados.length} override(s) manual(es) en el período. Al aprobar, se invalidarán. Confirme con confirmar_invalidar_overrides: true.`,
    };
  }

  if (overridesEncontrados.length > 0 && confirmarInvalidarOverrides) {
    const invalidados = await invalidarOverridesFantasma(overridesEncontrados);
    warnings.push({
      code: "PLT-APR-W001",
      mensaje: `Se invalidaron ${invalidados} override(s) por re-planificación.`,
    });
  }

  const obs = request.data && request.data.observaciones;
  const aprobacion = buildAprobacion(request, "aprobar", obs);
  await ref.update({
    estado: "HABILITADO",
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  if (plan.tipo_plan === "mensual" && plan.periodo) {
    const [anio, mes] = plan.periodo.split("-").map(Number);
    try {
      await materializarGrupoMes({ grupoId: plan.grupo_id, anio, mes });
      logger.info("materializarGrupoMes_post_aprobar OK", { planId });
    } catch (e) {
      logger.error("materializarGrupoMes_post_aprobar ERROR", { planId, error: String(e) });
    }
  }

  return { ok: true, id: planId, estado: "HABILITADO", warnings };
});

/**
 * Rechazar plan: ENVIADO|EN_REVISION → BORRADOR.
 * Turnos materializados NO se des-materializan.
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
  assertEstados(plan, ["ENVIADO", "EN_REVISION"]);

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
 * RRHH revierte plan habilitado: HABILITADO → EN_REVISION.
 * Los turnos materializados NO se borran (se mantienen hasta re-aprobación).
 */
const revertirPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const planId = request.data && request.data.plan_id;
  const observaciones = request.data && request.data.observaciones;
  if (!planId) err("invalid-argument", "[PLT-REV-001] plan_id requerido.");
  if (!observaciones || typeof observaciones !== "string" || !observaciones.trim()) {
    err("invalid-argument", "[PLT-REV-002] Observaciones de revisión requeridas.");
  }

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-REV-003] Plan no encontrado.");

  const plan = snap.data();
  assertEstado(plan, "HABILITADO");

  const aprobacion = buildAprobacion(request, "revertir", observaciones);
  await ref.update({
    estado: "EN_REVISION",
    observaciones_revision: observaciones.trim().slice(0, 500),
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, id: planId, estado: "EN_REVISION" };
});

/**
 * Bandeja RRHH cross-grupo: planes ENVIADO o EN_REVISION de todos los grupos.
 * Enriquece con nombre de grupo. Límite 200.
 */
const listarPlanesPendientesRrhh = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const COL_GDT = "grupos_de_trabajo";
  const MAX_ITEMS = 200;

  const snapEnviado = await db.collection(COL_PLANES).where("estado", "==", "ENVIADO").get();
  const snapRevision = await db.collection(COL_PLANES).where("estado", "==", "EN_REVISION").get();

  const docs = [...snapEnviado.docs, ...snapRevision.docs];
  const items = docs.slice(0, MAX_ITEMS).map((d) => ({ id: d.id, ...d.data() }));

  const grupoIds = [...new Set(items.map((i) => i.grupo_id).filter(Boolean))];
  const grupoLabels = {};
  for (const gid of grupoIds) {
    try {
      const gSnap = await db.collection(COL_GDT).doc(gid).get();
      if (gSnap.exists) {
        const gd = gSnap.data() || {};
        grupoLabels[gid] = String(gd.nombre || gd.codigo || gd.titulo || "").trim() || gid;
      } else {
        grupoLabels[gid] = gid;
      }
    } catch {
      grupoLabels[gid] = gid;
    }
  }

  for (const item of items) {
    item.grupo_label = grupoLabels[item.grupo_id] || item.grupo_id;
  }

  return { items, tiene_mas: docs.length > MAX_ITEMS };
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

  const hoy = new Date();
  try {
    await materializarGrupoMes({ grupoId: plan.grupo_id, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
    logger.info("materializarGrupoMes_post_cerrar OK", { planId });
  } catch (e) {
    logger.error("materializarGrupoMes_post_cerrar ERROR", { planId, error: String(e) });
  }

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
  const errors = [];
  for (const ag of plan.agentes || []) {
    if (!ag.regimen_horario_id) continue;
    const regSnap = await db.collection("cfg_regimen_horario").doc(ag.regimen_horario_id).get();
    if (!regSnap.exists) continue;
    const reg = regSnap.data();

    const dias = ag.dias || {};
    const diasKeys = Object.keys(dias).sort();
    const diasArr = Object.values(dias);

    // Validar vigencia HLG: buscar HLG activo
    if (ag.hlg_id) {
      const hlgSnap = await db.collection("historial_laboral_grupos").doc(ag.hlg_id).get();
      if (hlgSnap.exists) {
        const hlg = hlgSnap.data();
        const fi = hlg.fecha_inicio || "";
        const ff = hlg.fecha_fin || "";
        for (const ymd of diasKeys) {
          const cel = dias[ymd];
          if (cel.tipo_dia === "franco") continue;
          if ((fi && ymd < fi) || (ff && ymd > ff)) {
            errors.push({
              code: "PLT-VIG-E001",
              persona_id: ag.persona_id,
              mensaje: `Turno en ${ymd} fuera de vigencia HLG (${fi || "∞"} a ${ff || "∞"}).`,
            });
          }
        }
      }
    }

    // Validar dias no asignados al grupo segun regimen (fijo/rotativo)
    if (reg.tipo_patron === "fijo") {
      for (const ymd of diasKeys) {
        const cel = dias[ymd];
        if (cel.tipo_dia === "franco") continue;
        const date = new Date(ymd + "T12:00:00");
        const dow = date.getUTCDay();
        const isoWeekday = dow === 0 ? 7 : dow;
        const diaConf = (reg.dias || []).find((d) => d.dia_semana === isoWeekday);
        const asignado = diaConf && (diaConf.tipo_dia === "laborable" || diaConf.tipo_dia === "guardia");
        if (!asignado) {
          warnings.push({
            code: "PLT-REG-W010",
            persona_id: ag.persona_id,
            mensaje: `Turno en ${ymd} no es dia asignado al grupo segun regimen fijo.`,
          });
        }
      }
    }

    // Reglas de planificacion (solo planificado, pero aplicar a todos si existen)
    const reglas = reg.reglas_planificacion || {};
    const diasTrabajo = diasArr.filter((d) => d.tipo_dia === "laborable" || d.tipo_dia === "guardia").length;
    const diasFranco = diasArr.filter((d) => d.tipo_dia === "franco").length;

    if (reglas.dias_trabajo_max_mes != null && diasTrabajo > reglas.dias_trabajo_max_mes) {
      warnings.push({
        code: "PLT-REG-W001",
        persona_id: ag.persona_id,
        mensaje: `${diasTrabajo} dias trabajo > max. ${reglas.dias_trabajo_max_mes}.`,
      });
    }
    if (reglas.dias_franco_min_mes != null && diasFranco < reglas.dias_franco_min_mes) {
      warnings.push({
        code: "PLT-REG-W002",
        persona_id: ag.persona_id,
        mensaje: `${diasFranco} francos < min. ${reglas.dias_franco_min_mes}.`,
      });
    }

    // Consecutivos trabajo/franco
    if (reglas.max_consecutivos_trabajo != null || reglas.min_consecutivos_franco != null) {
      let consecTrabajo = 0;
      let consecFranco = 0;
      for (const ymd of diasKeys) {
        const cel = dias[ymd];
        const esTrabajo = cel.tipo_dia === "laborable" || cel.tipo_dia === "guardia";
        if (esTrabajo) {
          consecTrabajo++;
          if (consecFranco > 0 && reglas.min_consecutivos_franco != null && consecFranco < reglas.min_consecutivos_franco) {
            warnings.push({
              code: "PLT-REG-W004",
              persona_id: ag.persona_id,
              mensaje: `Solo ${consecFranco} franco(s) consecutivo(s) antes de ${ymd} (min: ${reglas.min_consecutivos_franco}).`,
            });
          }
          consecFranco = 0;
          if (reglas.max_consecutivos_trabajo != null && consecTrabajo > reglas.max_consecutivos_trabajo) {
            warnings.push({
              code: "PLT-REG-W003",
              persona_id: ag.persona_id,
              mensaje: `${consecTrabajo} dias trabajo consecutivos en ${ymd} > max. ${reglas.max_consecutivos_trabajo}.`,
            });
          }
        } else {
          consecFranco++;
          consecTrabajo = 0;
        }
      }
    }
  }

  if (errors.length > 0) {
    err("failed-precondition", `[PLT-VIG] ${errors.length} error(es) de vigencia: ${errors.map((e) => e.mensaje).join("; ")}`);
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

/**
 * Retorna contexto enriquecido para la grilla del jefe:
 * personas del grupo con HLG vigente + regímenes deduplicados.
 * ~43 reads para 20 agentes con 3 regímenes.
 */
const listarContextoPlanGrupo = onCall({ invoker: "public" }, async (request) => {
  const grupoId = request.data && request.data.grupo_id;
  const periodo = request.data && request.data.periodo;
  if (!grupoId) err("invalid-argument", "[CTX-001] grupo_id requerido.");

  const hlgSnap = await db.collection("historial_laboral_grupos")
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("activo", "==", true)
    .get();

  if (hlgSnap.empty) return { personas_grupo: [], regimenes: {} };

  const personasGrupo = [];
  const regimenIds = new Set();
  const personaIds = new Set();

  for (const doc of hlgSnap.docs) {
    const d = doc.data();
    personasGrupo.push({
      hlg_id: doc.id,
      persona_id: d.persona_id,
      regimen_horario_id: d.regimen_horario_id || null,
      fecha_inicio: d.fecha_inicio || null,
      fecha_fin: d.fecha_fin || null,
      regimen_fecha_ancla: d.regimen_fecha_ancla || null,
      dato_laboral_id: d.dato_laboral_id || null,
    });
    if (d.regimen_horario_id) regimenIds.add(d.regimen_horario_id);
    if (d.persona_id) personaIds.add(d.persona_id);
  }

  // Enriquecer con nombre de persona
  const personaDocs = {};
  if (personaIds.size > 0) {
    const personaChunks = [...personaIds];
    for (let i = 0; i < personaChunks.length; i += 10) {
      const chunk = personaChunks.slice(i, i + 10);
      const snap = await db.collection("personas").where("__name__", "in", chunk).get();
      for (const pdoc of snap.docs) {
        const pd = pdoc.data();
        personaDocs[pdoc.id] = {
          nombre_completo: [pd.apellido, pd.nombre].filter(Boolean).join(", ") || pdoc.id,
          dni: pd.dni || null,
        };
      }
    }
  }

  for (const pg of personasGrupo) {
    const pdata = personaDocs[pg.persona_id] || {};
    pg.persona_label = pdata.nombre_completo || pg.persona_id;
    pg.persona_dni = pdata.dni || null;
  }

  // Cargar regímenes deduplicados
  const regimenes = {};
  for (const rid of regimenIds) {
    const rsnap = await db.collection("cfg_regimen_horario").doc(rid).get();
    if (rsnap.exists) {
      const rd = rsnap.data();
      regimenes[rid] = {
        id: rid,
        nombre: rd.nombre || "",
        codigo: rd.codigo || "",
        tipo_patron: rd.tipo_patron || "",
        turnos_disponibles: rd.turnos_disponibles || [],
        dias: rd.dias || [],
        ciclo: rd.ciclo || [],
        ciclo_total: rd.ciclo_total || 0,
        impacta_calendario_institucional: rd.impacta_calendario_institucional !== false,
        reglas_planificacion: rd.reglas_planificacion || null,
      };
    }
  }

  return { personas_grupo: personasGrupo, regimenes };
});

module.exports = {
  guardarPlanTurnoServicio,
  enviarPlanTurnoServicio,
  aprobarPlanTurnoServicio,
  rechazarPlanTurnoServicio,
  revertirPlanTurnoServicio,
  cerrarPlanPerpetuo,
  listarPlanesTurnoServicio,
  listarPlanesPendientesRrhh,
  listarContextoPlanGrupo,
};

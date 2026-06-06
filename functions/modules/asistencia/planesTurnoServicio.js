"use strict";

/**
 * Callables para gestión de planes de turno por servicio.
 * Máquina de estados: BORRADOR → ENVIADO → HABILITADO.
 * EN_REVISION (RRHH revierte) → puede re-enviarse o rechazarse.
 * Cerrado: HABILITADO → CERRADO (solo perpetuos).
 */

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../shared/context");
const runtimeFlags = require("../shared/runtimeFlags.json");
const { assertRrhh, assertPlanAuth } = require("../shared/helpers");
const {
  resolverAprobacionPendientePlan,
  assertPlanAprobarORechazar,
} = require("./planAutorizacionJerarquica");
const { materializarGrupoMes } = require("./rdaTurnoTeoricoWorker");
const { construirGrillaAprobada } = require("./planGrillaAprobadaBuilder");
const { logger } = require("firebase-functions/v2");
const { buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const { COL_VISTAS_GRILLA_MES } = require("../shared/mdcComandosConstants");
const { getInfoDia } = require("../shared/calendarService");
const { enriquecerAgentesDiasPlan } = require("./planEnriquecimientoDias");
const { buildPersonaLabel } = require("../shared/eventosV2");
const {
  personaIdsEnPlan,
  hlgIdsEnPlan,
  elegirPlanMensualCanonico,
  detectarAgentesNuevosPlanificados,
  mergeAgentesIncorporacionPlanMensual,
} = require("./planGrupoAgentesNuevos");
const { hlgSegmentosMes, buildFilaId } = require("../shared/hlgSegmentosMes");
const { derivarCargaSemanalDesdeRegimen } = require("../catalogosShared");
const {
  PLAN_ROL_PRINCIPAL,
  PLAN_ROL_INCORPORACION,
  PLAN_ROLES,
  ESTADOS_PLAN_TURNO_SERVICIO,
  buildPlanMetaPayload,
  planRolDeDoc,
} = require("./planTurnoServicioMeta");
const { assertPlanSinHuecosTurno } = require("./validacionesPlanTurno");
const {
  ESTADOS_INCORPORACION_FLUJO_ACTIVO,
  esPlanIncorporacionActivo,
  agentesStubIncorporacion,
  assertPadreHabilitadoParaMerge,
  mergeAgentesEditorAlPadre,
  appendGrillaAprobadaParcial,
  buildRegistroIncorporacionMergeada,
} = require("./planIncorporacionParalelo");
const crypto = require("crypto");

const COL_PLANES = "planes_turno_servicio";
const COL_PERSONAS = "personas";
const PERSONAS_GETALL_CHUNK = 10;

function nombreLegiblePersonaDoc(d) {
  const apellido = String(d?.apellido || "").trim();
  const nombre = String(d?.nombre || "").trim();
  const full = [apellido, nombre].filter(Boolean).join(", ");
  return full || buildPersonaLabel(d);
}
const MAX_AGENTES_PLAN = 50;
const COL_ASISTENCIA = "asistencia_diaria";

const ESTADOS_VALIDOS = new Set(ESTADOS_PLAN_TURNO_SERVICIO);
const TIPOS_PLAN = new Set(["perpetuo", "mensual"]);

function err(code, msg) {
  throw new HttpsError(code, msg);
}

/**
 * Un solo plan mensual activo por grupo+período. Solo `eliminado: true` libera el slot.
 */
async function assertSinIncorporacionActiva({ grupoId, periodo, excludePlanId }) {
  if (!grupoId || !periodo) return;
  const snap = await db
    .collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodo)
    .where("tipo_plan", "==", "mensual")
    .limit(30)
    .get();
  const conflicto = snap.docs.find((d) => {
    if (excludePlanId && d.id === excludePlanId) return false;
    return esPlanIncorporacionActivo(d.data());
  });
  if (conflicto) {
    err(
      "failed-precondition",
      `[PLT-INC-006] Ya existe un plan de incorporación activo (${conflicto.id}, estado ${conflicto.data()?.estado || "?"}).`,
    );
  }
}

async function assertSinPlanMensualVigente({ grupoId, periodo, excludePlanId }) {
  if (!grupoId || !periodo) return;
  const snap = await db
    .collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodo)
    .where("tipo_plan", "==", "mensual")
    .limit(20)
    .get();
  const conflicto = snap.docs.find((d) => {
    if (excludePlanId && d.id === excludePlanId) return false;
    const data = d.data() || {};
    if (data.eliminado === true) return false;
    if (planRolDeDoc(data) !== PLAN_ROL_PRINCIPAL) return false;
    if (data.estado === "MERGEADO") return false;
    return true;
  });
  if (conflicto) {
    const p = conflicto.data() || {};
    err(
      "failed-precondition",
      `[PLT-GRD-001] Ya existe un plan activo para ${grupoId} / ${periodo} ` +
        `(${conflicto.id}, estado ${p.estado || "?"}). ` +
        "Eliminá el plan anterior con borrado lógico (RRHH) antes de crear otro.",
    );
  }
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
  const actorLabel =
    String(token.nombre_completo || "").trim() ||
    String(token.display_name || "").trim() ||
    String(token.name || "").trim() ||
    String(token.email || "").trim() ||
    null;
  return {
    actor_uid: uid,
    actor_persona_id: token.persona_id || null,
    actor_label: actorLabel,
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

function assertLimiteAgentes(datos) {
  if (datos.agentes.length > MAX_AGENTES_PLAN) {
    err(
      "resource-exhausted",
      `[PLT-MAX-050] El plan no puede superar ${MAX_AGENTES_PLAN} agentes (tiene ${datos.agentes.length}).`,
    );
  }
}

function parseComentariosJefe(datos) {
  const c = datos.comentarios_jefe;
  if (c == null || c === "") return null;
  if (typeof c !== "string") err("invalid-argument", "[PLT-COM-001] comentarios_jefe debe ser texto.");
  const t = c.trim();
  if (t.length > 200) err("invalid-argument", "[PLT-COM-002] comentarios_jefe máximo 200 caracteres.");
  return t;
}

function nuevoPlanVersionToken() {
  return crypto.randomUUID();
}

function assertAgentesEnriquecidos(agentesIn, agentesOut) {
  if (!Array.isArray(agentesOut) || agentesOut.length !== agentesIn.length) {
    err(
      "failed-precondition",
      "[PLT-ENR-001] No se pudo enriquecer el plan (revisá regímenes horarios y desplegá Functions v2).",
    );
  }
  for (const ag of agentesOut) {
    const dias = ag.dias && typeof ag.dias === "object" ? ag.dias : {};
    for (const [ymd, cel] of Object.entries(dias)) {
      if (!cel || typeof cel !== "object") continue;
      const tipo = cel.tipo_dia;
      if (tipo === "laborable" || tipo === "guardia") {
        if (cel.turno_id && !cel.ingreso && !cel.ingreso_iso) {
          err(
            "failed-precondition",
            `[PLT-ENR-002] Horario teórico faltante en ${ag.persona_id} · ${ymd} (turno ${cel.turno_id}).`,
          );
        }
        if (cel.ingreso && /^\d{4}-\d{2}-\d{2}T/.test(String(cel.ingreso))) {
          err(
            "failed-precondition",
            `[PLT-ENR-004] ingreso debe ser HH:mm AR en ${ag.persona_id} · ${ymd}.`,
          );
        }
        if ((cel.ingreso || cel.turno_id) && !cel.ingreso_iso) {
          err(
            "failed-precondition",
            `[PLT-ENR-005] ingreso_iso faltante en ${ag.persona_id} · ${ymd}.`,
          );
        }
      }
      if (typeof cel.es_feriado !== "boolean") {
        err(
          "failed-precondition",
          `[PLT-ENR-003] Celda sin es_feriado en ${ag.persona_id} · ${ymd}.`,
        );
      }
    }
  }
}

function validarPlanMensual(datos) {
  const periodo = typeof datos.periodo === "string" ? datos.periodo.trim() : "";
  if (!/^\d{4}-\d{2}$/.test(periodo)) err("invalid-argument", "[PLT-005] periodo YYYY-MM requerido para plan mensual.");
  assertLimiteAgentes(datos);
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
  assertLimiteAgentes(datos);
  for (let i = 0; i < datos.agentes.length; i++) {
    const ag = datos.agentes[i];
    if (!ag.persona_id || !ag.regimen_horario_id || !ag.hlg_id) {
      err("invalid-argument", `[PLT-008] agentes[${i}]: persona_id, regimen_horario_id y hlg_id requeridos.`);
    }
  }
  return { vigente_desde, vigente_hasta: datos.vigente_hasta || null };
}

/**
 * Crea plt_inc en BORRADOR (plan paralelo) sin mutar el principal HABILITADO.
 */
const iniciarIncorporacionPlanMensual = onCall({ invoker: "public" }, async (request) => {
  const planPadreId =
    request.data && typeof request.data.plan_padre_id === "string"
      ? request.data.plan_padre_id.trim()
      : "";
  if (!planPadreId) err("invalid-argument", "[PLT-INC-007] plan_padre_id requerido.");

  const padreSnap = await db.collection(COL_PLANES).doc(planPadreId).get();
  if (!padreSnap.exists) err("not-found", "[PLT-INC-008] Plan padre no encontrado.");
  const padre = padreSnap.data() || {};
  const valPadre = assertPadreHabilitadoParaMerge(padre, planPadreId);
  if (!valPadre.ok) err("failed-precondition", valPadre.message);

  if (padre.tipo_plan !== "mensual" || !padre.periodo) {
    err("failed-precondition", "[PLT-INC-009] La incorporación paralela aplica solo a planes mensuales.");
  }

  const grupoId = padre.grupo_id;
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertPlanAuth(request, grupoId, "guardar");

  await assertSinIncorporacionActiva({
    grupoId,
    periodo: padre.periodo,
    excludePlanId: null,
  });

  const { personasGrupo, regimenes } = await cargarPersonasYRegimenesPlanGrupo(grupoId, padre.periodo);
  const agentesNuevos = detectarAgentesNuevosPlanificados({
    personasGrupo,
    regimenes,
    personaIdsEnPlanMensual: personaIdsEnPlan(padre),
    hlgIdsEnPlanMensual: hlgIdsEnPlan(padre),
  });
  if (agentesNuevos.length === 0) {
    err(
      "failed-precondition",
      "[PLT-INC-003] No hay agentes nuevos planificados para incorporar en este período.",
    );
  }

  const { ulid } = require("ulid");
  const id = `plt_${ulid()}`;
  const now = FieldValue.serverTimestamp();
  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};
  const agentes = agentesStubIncorporacion(agentesNuevos);
  const planVersionToken = nuevoPlanVersionToken();

  const payload = {
    id,
    grupo_id: grupoId,
    tipo_plan: "mensual",
    periodo: padre.periodo,
    estado: "BORRADOR",
    agentes,
    ...buildPlanMetaPayload({
      agentes,
      plan_rol: PLAN_ROL_INCORPORACION,
      plan_padre_id: planPadreId,
    }),
    plan_version_token: planVersionToken,
    comentarios_jefe: null,
    observaciones_rechazo: null,
    creado_por_uid: uid,
    creado_por_persona_id: token.persona_id || null,
    creado_en: now,
    actualizado_en: now,
    historial_aprobaciones: [],
  };

  await db.collection(COL_PLANES).doc(id).set(payload, { merge: true });

  return {
    ok: true,
    id,
    plan_padre_id: planPadreId,
    estado: "BORRADOR",
    plan_rol: PLAN_ROL_INCORPORACION,
    agentes_nuevos: agentesNuevos,
    plan_version_token: planVersionToken,
  };
});

/**
 * Crea o actualiza un plan en estado BORRADOR.
 */
const guardarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const datos = request.data && request.data.datos;
  const modoIncorporacionAgentesNuevos =
    request.data && request.data.modo_incorporacion_agentes_nuevos === true;
  const { grupoId, tipoPlan } = validarDatosBase(datos);
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertPlanAuth(request, grupoId, "guardar");

  const now = FieldValue.serverTimestamp();
  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  const comentariosJefe = parseComentariosJefe(datos);
  const tokenEnviado =
    typeof datos.plan_version_token === "string" ? datos.plan_version_token.trim() : "";
  const rolSolicitado =
    typeof datos.plan_rol === "string" && PLAN_ROLES.has(datos.plan_rol.trim())
      ? datos.plan_rol.trim()
      : PLAN_ROL_PRINCIPAL;

  let especificos;
  if (tipoPlan === "mensual") {
    const { periodo } = validarPlanMensual(datos);
    especificos = {
      tipo_plan: "mensual",
      periodo,
      agentes: [],
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
      const prevEst = snap.data();
      if (prevEst?.estado === "MERGEADO") {
        err("failed-precondition", "[PLT-EST] El plan de incorporación ya fue mergeado y no admite edición.");
      }
      assertEstados(prevEst, ["BORRADOR", "EN_REVISION"]);
      exists = true;
    }
  }

  if (!id) {
    const { ulid } = require("ulid");
    id = `plt_${ulid()}`;
  }

  let estadoTrasGuardar = "BORRADOR";

  if (tipoPlan === "mensual") {
    let planDocPrevio = null;
    if (exists) {
      const prevSnap = await db.collection(COL_PLANES).doc(id).get();
      if (prevSnap.exists) planDocPrevio = prevSnap.data();
    }

    if (modoIncorporacionAgentesNuevos && planDocPrevio && planRolDeDoc(planDocPrevio) === PLAN_ROL_PRINCIPAL) {
      err(
        "failed-precondition",
        "[PLT-INC-005] Incorporación en el plan principal ya no está soportada. Usá iniciarIncorporacionPlanMensual.",
      );
    }

    if (!exists) {
      if (rolSolicitado === PLAN_ROL_INCORPORACION) {
        err(
          "failed-precondition",
          "[PLT-INC-010] Creá el plan de incorporación con iniciarIncorporacionPlanMensual.",
        );
      }
      await assertPlanMensualConAgentesPlanificados(grupoId, especificos.periodo);
      await assertSinPlanMensualVigente({
        grupoId,
        periodo: especificos.periodo,
        excludePlanId: null,
      });
    }

    let agentesParaEnriquecer = datos.agentes;
    const rangoPlan = rangoPeriodoMensual(especificos.periodo);
    const ctxPlan = await cargarPersonasYRegimenesPlanGrupo(grupoId, especificos.periodo);
    const vigenciaPorHlg = buildVigenciaPorHlgDesdePersonasGrupo(ctxPlan.personasGrupo);
    assertAgentesHlgCoherentes(agentesParaEnriquecer, ctxPlan.personasGrupo);
    agentesParaEnriquecer = filtrarDiasAgentesPorVigenciaHlg(
      agentesParaEnriquecer,
      vigenciaPorHlg,
      rangoPlan.ultimoDia,
    );
    const celdaCuentaHuecos = buildCeldaCuentaParaHuecosPlan(vigenciaPorHlg, rangoPlan.ultimoDia);

    if (exists && planDocPrevio && planRolDeDoc(planDocPrevio) === PLAN_ROL_INCORPORACION) {
      assertEstados(planDocPrevio, ["BORRADOR", "EN_REVISION"]);
      const padreId = String(planDocPrevio.plan_padre_id || "").trim();
      if (!padreId) err("failed-precondition", "[PLT-INC-011] plan_padre_id faltante en incorporación.");
      const padreSnap = await db.collection(COL_PLANES).doc(padreId).get();
      const valPadre = assertPadreHabilitadoParaMerge(padreSnap.exists ? padreSnap.data() : null, padreId);
      if (!valPadre.ok) err("failed-precondition", valPadre.message);

      const { personasGrupo, regimenes } = ctxPlan;
      const agentesNuevos = detectarAgentesNuevosPlanificados({
        personasGrupo,
        regimenes,
        personaIdsEnPlanMensual: personaIdsEnPlan(padreSnap.data()),
        hlgIdsEnPlanMensual: hlgIdsEnPlan(padreSnap.data()),
      });
      const idsPermitidos = new Set(agentesNuevos.map((a) => a.persona_id));
      if (idsPermitidos.size === 0) {
        err("failed-precondition", "[PLT-INC-003] No hay agentes nuevos planificados para incorporar.");
      }
      const merged = mergeAgentesIncorporacionPlanMensual([], datos.agentes, idsPermitidos);
      if (!merged.ok) {
        err("permission-denied", `[${merged.code}] Solo podés asignar turnos a agentes nuevos permitidos.`);
      }
      const incorporados = new Set(
        (datos.agentes || []).map((a) => String(a.persona_id || "").trim()).filter(Boolean),
      );
      if (![...idsPermitidos].some((pid) => incorporados.has(pid))) {
        err("invalid-argument", "[PLT-INC-004] Debe guardar al menos un agente nuevo en la grilla.");
      }
      agentesParaEnriquecer = merged.agentes;
      estadoTrasGuardar = planDocPrevio.estado === "EN_REVISION" ? "EN_REVISION" : "BORRADOR";
    }
    const agentesEnriquecidos = await enriquecerAgentesDiasPlan({
      periodo: especificos.periodo,
      planId: id,
      agentes: agentesParaEnriquecer,
    });
    assertAgentesEnriquecidos(agentesParaEnriquecer, agentesEnriquecidos);
    assertPlanSinHuecosTurno(agentesEnriquecidos, { celdaCuentaParaHuecos: celdaCuentaHuecos });
    especificos.agentes = agentesEnriquecidos;
  }

  const planVersionToken = nuevoPlanVersionToken();
  const ref = db.collection(COL_PLANES).doc(id);

  const padreSolicitado =
    typeof datos.plan_padre_id === "string" ? datos.plan_padre_id.trim() || null : null;
  if (rolSolicitado === PLAN_ROL_INCORPORACION && !padreSolicitado && !exists) {
    err("invalid-argument", "[PLT-ROL-001] plan_padre_id requerido para plan_rol incorporacion.");
  }

  let rolPersistir = rolSolicitado;
  let padrePersistir = padreSolicitado;
  if (exists) {
    const prev = (await ref.get()).data() || {};
    rolPersistir = planRolDeDoc(prev);
    padrePersistir = prev.plan_padre_id ?? null;
  }

  const payloadBase = {
    id,
    grupo_id: grupoId,
    estado: estadoTrasGuardar,
    ...especificos,
    ...buildPlanMetaPayload({
      agentes: especificos.agentes,
      plan_rol: rolPersistir,
      plan_padre_id: padrePersistir,
    }),
    comentarios_jefe: comentariosJefe,
    plan_version_token: planVersionToken,
    creado_por_uid: uid,
    creado_por_persona_id: token.persona_id || null,
    observaciones_rechazo: null,
    actualizado_en: now,
  };

  if (!exists) {
    const payload = {
      ...payloadBase,
      creado_en: now,
      historial_aprobaciones: [],
    };
    await ref.set(payload, { merge: true });
    return {
      ok: true,
      id,
      estado: "BORRADOR",
      modo: "creado",
      plan_version_token: planVersionToken,
    };
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      err("not-found", "[PLT-SAV-001] Plan no encontrado.");
    }
    const actual = snap.data();
    const estadosPermitidos =
      planRolDeDoc(actual) === PLAN_ROL_INCORPORACION
        ? ["BORRADOR", "EN_REVISION"]
        : ["BORRADOR", "EN_REVISION"];
    assertEstados(actual, estadosPermitidos);
    const almacenado = String(actual.plan_version_token || "").trim();
    if (almacenado) {
      if (!tokenEnviado || tokenEnviado !== almacenado) {
        err(
          "aborted",
          "[PLT-CONC-001] El plan fue modificado por otro usuario. Recargá y volvé a guardar.",
        );
      }
    }
    tx.set(ref, payloadBase, { merge: true });
  });

  return {
    ok: true,
    id,
    estado: estadoTrasGuardar,
    modo: modoIncorporacionAgentesNuevos ? "incorporacion_agentes_nuevos" : "actualizado",
    plan_version_token: planVersionToken,
  };
});

/**
 * Jefe envía plan para aprobación: BORRADOR|EN_REVISION → ENVIADO.
 */
const enviarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  if (!planId) err("invalid-argument", "[PLT-ENV-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const preSnap = await ref.get();
  if (!preSnap.exists) err("not-found", "[PLT-ENV-002] Plan no encontrado.");
  const prePlan = preSnap.data();

  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertPlanAuth(request, prePlan.grupo_id, "enviar");

  const warnings = [];
  let agentesParaEnviar = prePlan.agentes;
  if (prePlan.tipo_plan === "mensual") {
    const { sanitizarAgentesPlanVigenciaHlg } = require("./planVigenciaHlg");
    agentesParaEnviar = await sanitizarAgentesPlanVigenciaHlg(db, prePlan.agentes || []);
    const regWarnings = await validarReglasContraRegimen({
      ...prePlan,
      agentes: agentesParaEnviar,
    });
    warnings.push(...regWarnings);
  }

  const aprobacion = buildAprobacion(request, "enviar", null);
  const creadorId =
    String(prePlan.creado_por_persona_id || "").trim() ||
    String((request.auth && request.auth.token && request.auth.token.persona_id) || "").trim();
  const aprobacionPendiente = await resolverAprobacionPendientePlan(db, {
    ...prePlan,
    creado_por_persona_id: creadorId,
  });

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err("not-found", "[PLT-ENV-002] Plan no encontrado.");
    assertEstados(snap.data(), ["BORRADOR", "EN_REVISION"]);
    const updatePayload = {
      estado: "ENVIADO",
      observaciones_rechazo: null,
      observaciones_revision: null,
      aprobacion_pendiente: aprobacionPendiente,
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    };
    if (prePlan.tipo_plan === "mensual" && agentesParaEnviar) {
      updatePayload.agentes = agentesParaEnviar;
    }
    tx.update(ref, updatePayload);
  });

  return {
    ok: true,
    id: planId,
    estado: "ENVIADO",
    warnings,
    aprobacion_pendiente: aprobacionPendiente,
    mensaje_bandeja: aprobacionPendiente.huerfano
      ? "Plan enviado. No hay superior jerárquico: RRHH lo revisará en su bandeja."
      : "Plan enviado para aprobación del superior jerárquico.",
  };
});

/**
 * Aprobación plt_inc: materialización acotada + merge atómico al padre HABILITADO.
 */
async function ejecutarAprobarPlanIncorporacion({
  request,
  planId,
  ref,
  plan,
  confirmarInvalidarOverrides,
}) {
  const padreId = String(plan.plan_padre_id || "").trim();
  if (!padreId) err("failed-precondition", "[PLT-INC-011] plan_padre_id faltante.");

  const padreRef = db.collection(COL_PLANES).doc(padreId);
  const padrePre = await padreRef.get();
  const valPadre = assertPadreHabilitadoParaMerge(padrePre.exists ? padrePre.data() : null, padreId);
  if (!valPadre.ok) err("failed-precondition", valPadre.message);

  const aprobacionPendiente =
    plan.aprobacion_pendiente || (await resolverAprobacionPendientePlan(db, plan));
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertPlanAprobarORechazar(request, plan, aprobacionPendiente);
  }

  const rangoInc = rangoPeriodoMensual(plan.periodo);
  const ctxInc = await cargarPersonasYRegimenesPlanGrupo(plan.grupo_id, plan.periodo);
  const vigInc = buildVigenciaPorHlgDesdePersonasGrupo(ctxInc.personasGrupo);
  assertPlanSinHuecosTurno(plan.agentes, {
    celdaCuentaParaHuecos: buildCeldaCuentaParaHuecosPlan(vigInc, rangoInc.ultimoDia),
  });

  const warnings = [];
  const overridesEncontrados = await detectarOverridesFantasma(plan);
  if (overridesEncontrados.length > 0 && !confirmarInvalidarOverrides) {
    const detallePreview = overridesEncontrados.slice(0, 20).map((o) => ({
      persona_id: o.persona_id,
      fecha: o.fecha,
      cantidad: o.cantidad,
      doc_id: o.doc_id,
    }));
    return {
      ok: false,
      requiere_confirmacion: true,
      overrides_afectados: overridesEncontrados.length,
      detalle_overrides: detallePreview,
      mensaje: `Existen ${overridesEncontrados.length} override(s) en el período de incorporación. Confirme con confirmar_invalidar_overrides: true.`,
    };
  }
  if (overridesEncontrados.length > 0 && confirmarInvalidarOverrides) {
    const invalidados = await invalidarOverridesFantasma(overridesEncontrados);
    warnings.push({
      code: "PLT-APR-W001",
      mensaje: `Se invalidaron ${invalidados} override(s) por incorporación.`,
    });
  }

  const obs = request.data && request.data.observaciones;
  const aprobacion = buildAprobacion(request, "aprobar_incorporacion", obs);
  const token = (request.auth && request.auth.token) || {};
  const actorPersonaId = token.persona_id || null;

  const personaIdsFilter = (plan.agentes || [])
    .map((a) => String(a.persona_id || "").trim())
    .filter((pid) => /^per_/i.test(pid));

  let grillaNuevaAgentes = null;
  if (plan.tipo_plan === "mensual" && plan.periodo) {
    const [anio, mes] = plan.periodo.split("-").map(Number);
    const planCache = { planId, plan };
    const mat = await materializarGrupoMes({
      grupoId: plan.grupo_id,
      anio,
      mes,
      planCache,
      personaIdsFilter,
      materializacionMotivo: "aprobar_incorporacion_paralela",
    });
    if (!mat.ok) {
      const det = (mat.fallos || []).slice(0, 5).map((f) => `${f.personaId}: ${f.error}`).join("; ");
      err(
        "failed-precondition",
        `[PLT-APR-MAT] Materialización incompleta (${mat.fallos?.length || 0} fallo(s)). ${det}`,
      );
    }
    const grillaNueva = await construirGrillaAprobada({ plan, planId });
    if (!grillaNueva?.agentes?.length) {
      err("failed-precondition", "[PLT-APR-GRD] No se pudo construir grilla de incorporación.");
    }
    grillaNuevaAgentes = grillaNueva.agentes;
    logger.info("materializarGrupoMes_incorporacion OK", {
      planId,
      padreId,
      personas: personaIdsFilter,
    });
  }

  const nuevoTokenPadre = nuevoPlanVersionToken();
  const registroMerge = buildRegistroIncorporacionMergeada({ planHijoId: planId, actorPersonaId });

  await db.runTransaction(async (tx) => {
    const hijoSnap = await tx.get(ref);
    if (!hijoSnap.exists) err("not-found", "[PLT-APR-002] Plan no encontrado.");
    const hijo = hijoSnap.data();
    assertEstados(hijo, ["ENVIADO", "EN_REVISION"]);
    if (planRolDeDoc(hijo) !== PLAN_ROL_INCORPORACION) {
      err("failed-precondition", "[PLT-INC-012] El documento no es un plan de incorporación.");
    }

    const padreSnap = await tx.get(padreRef);
    const padre = padreSnap.exists ? padreSnap.data() : null;
    const valTx = assertPadreHabilitadoParaMerge(padre, padreId);
    if (!valTx.ok) err("failed-precondition", valTx.message);

    const mergedAgentes = mergeAgentesEditorAlPadre(padre.agentes || [], hijo.agentes || []);
    if (!mergedAgentes.ok) {
      err(
        "failed-precondition",
        `[${mergedAgentes.code}] Conflicto al mergear agente ${mergedAgentes.persona_id} en el plan padre.`,
      );
    }

    const metaPadre = buildPlanMetaPayload({
      agentes: mergedAgentes.agentes,
      plan_rol: PLAN_ROL_PRINCIPAL,
      plan_padre_id: null,
    });

    const grillaPadre = appendGrillaAprobadaParcial(padre.grilla_aprobada, grillaNuevaAgentes);
    if (grillaNuevaAgentes?.length) {
      grillaPadre.periodo = grillaPadre.periodo || padre.periodo || hijo.periodo;
      grillaPadre.grupo_id = grillaPadre.grupo_id || padre.grupo_id;
      grillaPadre.version = grillaPadre.version || 1;
      grillaPadre.materializado_parcial_en = new Date().toISOString();
    }

    tx.update(padreRef, {
      agentes: mergedAgentes.agentes,
      ...metaPadre,
      grilla_aprobada: grillaPadre,
      grilla_aprobada_en: FieldValue.serverTimestamp(),
      plan_version_token: nuevoTokenPadre,
      incorporaciones_mergeadas: FieldValue.arrayUnion(registroMerge),
      actualizado_en: FieldValue.serverTimestamp(),
    });

    tx.update(ref, {
      estado: "MERGEADO",
      resultado_merge: {
        plan_padre_id: padreId,
        mergeado_en: registroMerge.mergeado_en,
        mergeado_por_persona_id: actorPersonaId,
      },
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  });

  return {
    ok: true,
    id: planId,
    estado: "MERGEADO",
    plan_padre_id: padreId,
    warnings,
  };
}

/**
 * Superior (o RRHH en caso huérfano) aprueba: ENVIADO → HABILITADO.
 * Absorbe la lógica de materialización + overrides fantasma.
 */
const aprobarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && request.data.plan_id;
  const confirmarInvalidarOverrides = request.data && request.data.confirmar_invalidar_overrides === true;
  if (!planId) err("invalid-argument", "[PLT-APR-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const preSnap = await ref.get();
  if (!preSnap.exists) err("not-found", "[PLT-APR-002] Plan no encontrado.");
  let plan = preSnap.data();

  if (planRolDeDoc(plan) === PLAN_ROL_INCORPORACION) {
    return ejecutarAprobarPlanIncorporacion({
      request,
      planId,
      ref,
      plan,
      confirmarInvalidarOverrides,
    });
  }

  let agentesEnriquecidosAprobar = null;
  if (plan.tipo_plan === "mensual" && plan.periodo && Array.isArray(plan.agentes) && plan.agentes.length > 0) {
    const rangoApr = rangoPeriodoMensual(plan.periodo);
    const ctxApr = await cargarPersonasYRegimenesPlanGrupo(plan.grupo_id, plan.periodo);
    const vigApr = buildVigenciaPorHlgDesdePersonasGrupo(ctxApr.personasGrupo);
    const huecosOpts = {
      celdaCuentaParaHuecos: buildCeldaCuentaParaHuecosPlan(vigApr, rangoApr.ultimoDia),
    };
    agentesEnriquecidosAprobar = await enriquecerAgentesDiasPlan({
      periodo: plan.periodo,
      planId,
      agentes: plan.agentes,
    });
    assertAgentesEnriquecidos(plan.agentes, agentesEnriquecidosAprobar);
    assertPlanSinHuecosTurno(agentesEnriquecidosAprobar, huecosOpts);
    plan = { ...plan, agentes: agentesEnriquecidosAprobar };
  } else {
    assertPlanSinHuecosTurno(plan.agentes);
  }

  const aprobacionPendiente =
    plan.aprobacion_pendiente || (await resolverAprobacionPendientePlan(db, plan));
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertPlanAprobarORechazar(request, plan, aprobacionPendiente);
  }

  const warnings = [];
  const overridesEncontrados = await detectarOverridesFantasma(plan);

  if (overridesEncontrados.length > 0 && !confirmarInvalidarOverrides) {
    const detallePreview = overridesEncontrados.slice(0, 20).map((o) => ({
      persona_id: o.persona_id,
      fecha: o.fecha,
      cantidad: o.cantidad,
      doc_id: o.doc_id,
    }));
    return {
      ok: false,
      requiere_confirmacion: true,
      overrides_afectados: overridesEncontrados.length,
      detalle_overrides: detallePreview,
      mensaje: `Existen ${overridesEncontrados.length} override(s) manual(es) en el período. Al aprobar, se invalidarán. Confirme con confirmar_invalidar_overrides: true.`,
    };
  }

  const obs = request.data && request.data.observaciones;
  const aprobacion = buildAprobacion(request, "aprobar", obs);

  if (overridesEncontrados.length > 0 && confirmarInvalidarOverrides) {
    const invalidados = await invalidarOverridesFantasma(overridesEncontrados);
    warnings.push({
      code: "PLT-APR-W001",
      mensaje: `Se invalidaron ${invalidados} override(s) por re-planificación.`,
    });
  }

  let grillaAprobada = null;
  if (plan.tipo_plan === "mensual" && plan.periodo) {
    const [anio, mes] = plan.periodo.split("-").map(Number);
    const planCache = { planId, plan };
    const mat = await materializarGrupoMes({ grupoId: plan.grupo_id, anio, mes, planCache });
    if (!mat.ok) {
      const det = (mat.fallos || []).slice(0, 5).map((f) => `${f.personaId}: ${f.error}`).join("; ");
      err(
        "failed-precondition",
        `[PLT-APR-MAT] Materialización incompleta (${mat.fallos?.length || 0} fallo(s)). ${det}`,
      );
    }
    grillaAprobada = await construirGrillaAprobada({ plan, planId });
    if (!grillaAprobada) {
      err("failed-precondition", "[PLT-APR-GRD] No se pudo construir grilla_aprobada desde la foto del plan.");
    }
    logger.info("materializarGrupoMes_pre_aprobar OK", {
      planId,
      grilla_agentes: grillaAprobada?.agentes?.length || 0,
    });
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err("not-found", "[PLT-APR-002] Plan no encontrado.");
    const current = snap.data();
    assertEstados(current, ["ENVIADO", "EN_REVISION"]);

    if (current.tipo_plan === "mensual" && current.periodo) {
      const dupSnap = await tx.get(
        db.collection(COL_PLANES)
          .where("grupo_id", "==", current.grupo_id)
          .where("periodo", "==", current.periodo)
          .where("tipo_plan", "==", "mensual")
          .limit(20),
      );
      const dupActivo = dupSnap.docs.find((d) => {
        if (d.id === planId) return false;
        const data = d.data() || {};
        if (data.eliminado === true) return false;
        if (planRolDeDoc(data) !== PLAN_ROL_PRINCIPAL) return false;
        if (data.estado === "MERGEADO") return false;
        return true;
      });
      if (dupActivo) {
        const e = dupActivo.data()?.estado || "?";
        err(
          "failed-precondition",
          `[PLT-APR-DUP] Ya existe un plan activo para ${current.grupo_id} / ${current.periodo} ` +
            `(${dupActivo.id}, estado ${e}). Eliminá el plan anterior (borrado lógico) primero.`,
        );
      }
    }

    const updatePayload = {
      estado: "HABILITADO",
      materializacion_fallida: false,
      materializacion_error: null,
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    };
    if (grillaAprobada) {
      updatePayload.grilla_aprobada = grillaAprobada;
      updatePayload.grilla_aprobada_en = FieldValue.serverTimestamp();
    }
    if (agentesEnriquecidosAprobar) {
      updatePayload.agentes = agentesEnriquecidosAprobar;
      Object.assign(
        updatePayload,
        buildPlanMetaPayload({
          agentes: agentesEnriquecidosAprobar,
          plan_rol: planRolDeDoc(current),
          plan_padre_id: current.plan_padre_id ?? null,
        }),
      );
    }
    tx.update(ref, updatePayload);
  });

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
  const preSnap = await ref.get();
  if (!preSnap.exists) err("not-found", "[PLT-REC-003] Plan no encontrado.");

  const planRec = preSnap.data();
  if (planRolDeDoc(planRec) === PLAN_ROL_INCORPORACION) {
    // Rechazo de plt_inc: vuelve a BORRADOR; el principal no se toca.
  } else if (planRec.estado === "MERGEADO") {
    err("failed-precondition", "[PLT-REC-004] El plan de incorporación ya fue mergeado.");
  }
  const aprobacionPendienteRec =
    planRec.aprobacion_pendiente || (await resolverAprobacionPendientePlan(db, planRec));
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertPlanAprobarORechazar(request, planRec, aprobacionPendienteRec);
  }

  const aprobacion = buildAprobacion(request, "rechazar", observaciones);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err("not-found", "[PLT-REC-003] Plan no encontrado.");
    assertEstados(snap.data(), ["ENVIADO", "EN_REVISION"]);
    tx.update(ref, {
      estado: "BORRADOR",
      observaciones_rechazo: observaciones.trim().slice(0, 500),
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    });
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

  const aprobacion = buildAprobacion(request, "revertir", observaciones);

  await db.runTransaction(async (tx) => {
    const ref = db.collection(COL_PLANES).doc(planId);
    const snap = await tx.get(ref);
    if (!snap.exists) err("not-found", "[PLT-REV-003] Plan no encontrado.");
    const revDoc = snap.data();
    if (planRolDeDoc(revDoc) !== PLAN_ROL_PRINCIPAL) {
      err("failed-precondition", "[PLT-REV-004] Solo se puede revertir el plan principal habilitado.");
    }
    assertEstado(revDoc, "HABILITADO");
    tx.update(ref, {
      estado: "EN_REVISION",
      observaciones_revision: observaciones.trim().slice(0, 500),
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, id: planId, estado: "EN_REVISION" };
});

/**
 * RRHH: eliminar plan (borrado lógico).
 * No borra físicamente: marca flags de eliminación + auditoría.
 * Si estaba HABILITADO, desmaterializa capa teórica del/los mes(es) afectados.
 */
const eliminarPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const planId = request.data && request.data.plan_id;
  if (!planId) err("invalid-argument", "[PLT-DEL-001] plan_id requerido.");

  const motivo = typeof (request.data && request.data.motivo_eliminacion) === "string"
    ? request.data.motivo_eliminacion.trim()
    : "";
  if (motivo.length < 10) {
    err("invalid-argument", "[PLT-DEL-002] motivo_eliminacion requerido (mín. 10 caracteres).");
  }

  const confirmar = request.data && request.data.confirmar_eliminacion === true;
  if (!confirmar) {
    err("failed-precondition", "[PLT-DEL-003] confirmar_eliminacion=true requerido.");
  }

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-DEL-004] Plan no encontrado.");
  const plan = snap.data();

  if (plan.eliminado === true) {
    return { ok: true, id: planId, ya_eliminado: true };
  }

  const aprobacion = buildAprobacion(request, "eliminar_logico", motivo);
  const estadoAnterior = String(plan.estado || "");

  await ref.update({
    eliminado: true,
    eliminado_en: new Date().toISOString(),
    eliminado_por_uid: uid,
    eliminado_por_persona_id: token.persona_id || null,
    motivo_eliminacion: motivo,
    estado_anterior_eliminacion: estadoAnterior,
    historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const warnings = [];
  const overridesEncontrados = await detectarOverridesFantasma(plan);
  if (overridesEncontrados.length > 0) {
    const invalidados = await invalidarOverridesFantasma(overridesEncontrados);
    warnings.push({
      code: "PLT-DEL-W001",
      mensaje: `Se invalidaron ${invalidados} override(s) por eliminación del plan.`,
    });
  }

  if (estadoAnterior === "HABILITADO") {
    if (plan.tipo_plan === "mensual" && plan.periodo) {
      const [anio, mes] = String(plan.periodo).split("-").map(Number);
      try {
        await materializarGrupoMes({ grupoId: plan.grupo_id, anio, mes });
        logger.info("materializarGrupoMes_post_eliminar OK", { planId, anio, mes });
      } catch (e) {
        logger.error("materializarGrupoMes_post_eliminar ERROR", { planId, anio, mes, error: String(e) });
        warnings.push({
          code: "PLT-DEL-W002",
          mensaje: "No se pudo desmaterializar automáticamente el mes del plan eliminado.",
        });
      }
    }

    if (plan.tipo_plan === "perpetuo") {
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1;
      const anioActual = hoy.getFullYear();
      const mesSig = mesActual === 12 ? 1 : mesActual + 1;
      const anioSig = mesActual === 12 ? anioActual + 1 : anioActual;
      for (const [a, m] of [[anioActual, mesActual], [anioSig, mesSig]]) {
        try {
          await materializarGrupoMes({ grupoId: plan.grupo_id, anio: a, mes: m });
          logger.info("materializarGrupoMes_post_eliminar_perpetuo OK", { planId, anio: a, mes: m });
        } catch (e) {
          logger.error("materializarGrupoMes_post_eliminar_perpetuo ERROR", { planId, anio: a, mes: m, error: String(e) });
          warnings.push({
            code: "PLT-DEL-W003",
            mensaje: `No se pudo desmaterializar ${a}-${String(m).padStart(2, "0")} del plan perpetuo eliminado.`,
          });
        }
      }
    }
  }

  return { ok: true, id: planId, eliminado: true, warnings };
});

/**
 * Bandeja RRHH cross-grupo: planes ENVIADO o EN_REVISION de todos los grupos.
 * Enriquece con nombre de grupo. Límite 200.
 */
const listarPlanesPendientesRrhh = onCall({ invoker: "public" }, async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const MAX_ITEMS = 200;

  const snapEnviado = await db.collection(COL_PLANES).where("estado", "==", "ENVIADO").limit(MAX_ITEMS).get();
  const snapRevision = await db.collection(COL_PLANES).where("estado", "==", "EN_REVISION").limit(MAX_ITEMS).get();

  const docs = [...snapEnviado.docs, ...snapRevision.docs];
  const raw = docs.slice(0, MAX_ITEMS).map((d) => ({ id: d.id, ...d.data() }));
  const activos = raw.filter((p) => {
    if (p.eliminado === true || p.estado === "MERGEADO") return false;
    if (planRolDeDoc(p) === PLAN_ROL_PRINCIPAL && p.estado === "HABILITADO") return false;
    return true;
  });
  const withPendiente = await enrichPlanesAprobacionPendiente(activos);
  const items = await enrichPlanesConLabels(withPendiente);

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

  const aprobacion = buildAprobacion(request, "cerrar", null);
  let grupoId;

  await db.runTransaction(async (tx) => {
    const ref = db.collection(COL_PLANES).doc(planId);
    const snap = await tx.get(ref);
    if (!snap.exists) err("not-found", "[PLT-CER-002] Plan no encontrado.");
    const plan = snap.data();
    assertEstado(plan, "HABILITADO");
    if (plan.tipo_plan !== "perpetuo") {
      err("failed-precondition", "[PLT-CER-003] Solo planes perpetuos pueden cerrarse manualmente.");
    }
    grupoId = plan.grupo_id;
    tx.update(ref, {
      estado: "CERRADO",
      vigente_hasta: fechaCierre || new Date().toISOString().slice(0, 10),
      historial_aprobaciones: FieldValue.arrayUnion(aprobacion),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  });

  if (grupoId) {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();
    const mesSig = mesActual === 12 ? 1 : mesActual + 1;
    const anioSig = mesActual === 12 ? anioActual + 1 : anioActual;
    for (const [a, m] of [[anioActual, mesActual], [anioSig, mesSig]]) {
      try {
        await materializarGrupoMes({ grupoId, anio: a, mes: m });
        logger.info("materializarGrupoMes_post_cerrar OK", { planId, anio: a, mes: m });
      } catch (e) {
        logger.error("materializarGrupoMes_post_cerrar ERROR", { planId, anio: a, mes: m, error: String(e) });
      }
    }
  }

  return { ok: true, id: planId, estado: "CERRADO" };
});

/**
 * Lista planes de un grupo (con filtro opcional de estado/periodo).
 */
const listarPlanesTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const grupoId = request.data && request.data.grupo_id;
  if (!grupoId) err("invalid-argument", "[PLT-LIST-001] grupo_id requerido.");
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertPlanAuth(request, grupoId, "leer");

  let q = db.collection(COL_PLANES).where("grupo_id", "==", grupoId);

  const estado = request.data && request.data.estado;
  if (estado && ESTADOS_VALIDOS.has(estado)) q = q.where("estado", "==", estado);

  const periodo = request.data && request.data.periodo;
  if (periodo) q = q.where("periodo", "==", periodo);

  const snap = await q.get();
  const raw = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const activos = raw.filter((p) => {
    if (p.eliminado === true) return false;
    if (estado === "MERGEADO") return p.estado === "MERGEADO";
    if (p.estado === "MERGEADO") return false;
    return true;
  });
  const withPendiente = await enrichPlanesAprobacionPendiente(activos);
  const items = await enrichPlanesConLabels(withPendiente);
  return { items };
});

// --- Helpers internos ---

async function enrichPlanesAprobacionPendiente(items) {
  return Promise.all(
    items.map(async (item) => {
      if (
        (item.estado === "ENVIADO" || item.estado === "EN_REVISION") &&
        !item.aprobacion_pendiente
      ) {
        return {
          ...item,
          aprobacion_pendiente: await resolverAprobacionPendientePlan(db, item),
        };
      }
      return item;
    }),
  );
}

async function loadGrupoLabels(items) {
  const COL_GDT = "grupos_de_trabajo";
  const grupoIds = [...new Set((items || []).map((i) => i?.grupo_id).filter(Boolean))];
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
  return grupoLabels;
}

async function enrichPlanesConLabels(items) {
  const base = Array.isArray(items) ? items : [];
  const grupoLabels = await loadGrupoLabels(base);

  const personaIds = new Set();
  for (const plan of base) {
    for (const ag of plan.agentes || []) {
      const pid = String(ag?.persona_id || "").trim();
      if (pid) personaIds.add(pid);
    }
    for (const h of plan.historial_aprobaciones || []) {
      const actorPid = String(h?.actor_persona_id || "").trim();
      if (actorPid) personaIds.add(actorPid);
    }
  }

  const personaDocs = {};
  const personaChunks = [...personaIds];
  for (let i = 0; i < personaChunks.length; i += 10) {
    const chunk = personaChunks.slice(i, i + 10);
    const snap = await db.collection("personas").where("__name__", "in", chunk).get();
    for (const pdoc of snap.docs) {
      const pd = pdoc.data() || {};
      personaDocs[pdoc.id] = {
        persona_label: [pd.apellido, pd.nombre].filter(Boolean).join(", ") || pdoc.id,
        persona_dni: pd.dni || null,
      };
    }
  }

  return base.map((plan) => ({
    ...plan,
    grupo_label: grupoLabels[plan.grupo_id] || plan.grupo_id,
    agentes: (plan.agentes || []).map((ag) => {
      const meta = personaDocs[String(ag?.persona_id || "").trim()] || {};
      return {
        ...ag,
        persona_label: meta.persona_label || ag.persona_id,
        persona_dni: meta.persona_dni || null,
      };
    }),
    historial_aprobaciones: (plan.historial_aprobaciones || []).map((h) => {
      const actorMeta = personaDocs[String(h?.actor_persona_id || "").trim()] || {};
      return {
        ...h,
        actor_label:
          String(h?.actor_label || "").trim() ||
          String(actorMeta.persona_label || "").trim() ||
          null,
      };
    }),
  }));
}

async function validarReglasContraRegimen(plan) {
  const { sanitizarAgentesPlanVigenciaHlg } = require("./planVigenciaHlg");
  const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd } = require("../shared/fechaLaboralYmd");
  const planSanitizado = {
    ...plan,
    agentes: await sanitizarAgentesPlanVigenciaHlg(db, plan.agentes || []),
  };
  const warnings = [];
  const errors = [];
  for (const ag of planSanitizado.agentes || []) {
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
        const fi = hldHlgFechaInicioYmd(hlg);
        const ff = hldHlgFechaFinYmd(hlg);
        for (const ymd of diasKeys) {
          const cel = dias[ymd];
          const tipo = String(cel?.tipo_dia || "").trim().toLowerCase();
          if (tipo === "franco" || tipo === "no_laborable") continue;
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
  if (plan.tipo_plan !== "mensual" || !plan.periodo) return [];

  // Solo aplica a régimen planificado: fijo/rotativo no se planifica manualmente en mensual.
  const personaIds = [];
  const regimenCache = new Map();
  for (const ag of plan.agentes || []) {
    const pid = String(ag?.persona_id || "").trim();
    const regId = String(ag?.regimen_horario_id || "").trim();
    if (!pid || !regId) continue;
    let tipo = regimenCache.get(regId);
    if (!tipo) {
      const regSnap = await db.collection("cfg_regimen_horario").doc(regId).get();
      tipo = regSnap.exists ? String(regSnap.data()?.tipo_patron || "").trim() : "";
      regimenCache.set(regId, tipo);
    }
    if (tipo === "planificado") personaIds.push(pid);
  }

  let fechas = [];
  if (plan.periodo) {
    const [anio, mes] = plan.periodo.split("-").map(Number);
    const diasMes = new Date(anio, mes, 0).getDate();
    for (let d = 1; d <= diasMes; d++) {
      fechas.push(`${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
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

function diaEnVigenciaHlgPlan(ymd, fechaInicio, fechaFin, ultimoDiaMes) {
  const y = String(ymd || "").slice(0, 10);
  const fi = String(fechaInicio || "").slice(0, 10);
  const ff = fechaFin ? String(fechaFin).slice(0, 10) : String(ultimoDiaMes || "").slice(0, 10);
  if (fi && y < fi) return false;
  if (ff && y > ff) return false;
  return true;
}

/**
 * Normaliza dias[] del payload: fuera de vigencia HLg → franco (no persistir planificación inválida).
 * @param {object[]} agentes
 * @param {Map<string, { fecha_inicio?: string, fecha_fin?: string|null }>} vigenciaPorHlg
 * @param {string} ultimoDiaMes
 */
function filtrarDiasAgentesPorVigenciaHlg(agentes, vigenciaPorHlg, ultimoDiaMes) {
  if (!Array.isArray(agentes)) return agentes;
  return agentes.map((ag) => {
    const hid = String(ag?.hlg_id || "").trim();
    const vig = vigenciaPorHlg.get(hid);
    if (!vig || !ag?.dias || typeof ag.dias !== "object") return ag;
    const dias = { ...ag.dias };
    for (const ymd of Object.keys(dias)) {
      if (!diaEnVigenciaHlgPlan(ymd, vig.fecha_inicio, vig.fecha_fin, ultimoDiaMes)) {
        dias[ymd] = { tipo_dia: "franco", turno_id: null };
      }
    }
    return { ...ag, dias };
  });
}

function buildVigenciaPorHlgDesdePersonasGrupo(personasGrupo) {
  const map = new Map();
  for (const pg of personasGrupo || []) {
    const hid = String(pg?.hlg_id || "").trim();
    if (!hid) continue;
    map.set(hid, {
      fecha_inicio: pg.fecha_inicio || pg.vigente_desde || null,
      fecha_fin: pg.fecha_fin ?? null,
      vigente_desde: pg.vigente_desde || null,
      vigente_hasta: pg.vigente_hasta || null,
    });
  }
  return map;
}

function buildCeldaCuentaParaHuecosPlan(vigenciaPorHlg, ultimoDiaMes) {
  return (ag, ymd) => {
    const hid = String(ag?.hlg_id || "").trim();
    if (!hid) return true;
    const vig = vigenciaPorHlg.get(hid);
    if (!vig) return true;
    return diaEnVigenciaHlgPlan(ymd, vig.fecha_inicio, vig.fecha_fin, ultimoDiaMes);
  };
}

function assertAgentesHlgCoherentes(agentes, personasGrupo) {
  const byHlg = new Map();
  for (const pg of personasGrupo || []) {
    const hid = String(pg?.hlg_id || "").trim();
    if (hid) byHlg.set(hid, pg);
  }
  for (let i = 0; i < (agentes || []).length; i += 1) {
    const ag = agentes[i];
    const hid = String(ag?.hlg_id || "").trim();
    const pid = String(ag?.persona_id || "").trim();
    if (!hid) continue;
    const ref = byHlg.get(hid);
    if (!ref) {
      err("invalid-argument", `[PLT-HLG-001] agentes[${i}]: hlg_id ${hid} no vigente en el grupo/período.`);
    }
    if (pid && ref.persona_id && pid !== ref.persona_id) {
      err("invalid-argument", `[PLT-HLG-002] agentes[${i}]: persona_id no coincide con hlg_id.`);
    }
    if (ag.regimen_horario_id && ref.regimen_horario_id && ag.regimen_horario_id !== ref.regimen_horario_id) {
      err("invalid-argument", `[PLT-HLG-003] agentes[${i}]: regimen_horario_id no coincide con el tramo HLg.`);
    }
  }
}

function hlgTramosPorPersona(personasGrupo) {
  const map = new Map();
  for (const pg of personasGrupo || []) {
    const pid = String(pg.persona_id || "").trim();
    if (!pid) continue;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push({
      fila_id: pg.fila_id || buildFilaId(pid, pg.hlg_id),
      hlg_id: pg.hlg_id,
      vigente_desde: pg.vigente_desde,
      vigente_hasta: pg.vigente_hasta,
      regimen_horario_id: pg.regimen_horario_id,
    });
  }
  return map;
}

function rangoPeriodoMensual(periodo) {
  const raw = typeof periodo === "string" ? periodo.trim() : "";
  let p = raw;
  if (!/^\d{4}-\d{2}$/.test(p)) {
    const now = new Date();
    p = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [anio, mes] = p.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    periodo: p,
    primerDia: `${p}-01`,
    ultimoDia: `${p}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/** HLG activo con solapamiento al mes del plan (inclusivo). */
function hlgSolapaPeriodo(hlg, primerDia, ultimoDia) {
  if (!hlg || hlg.activo === false) return false;
  const fi = typeof hlg.fecha_inicio === "string" ? hlg.fecha_inicio.trim() : "";
  const ff = typeof hlg.fecha_fin === "string" ? hlg.fecha_fin.trim() : "";
  if (fi && fi > ultimoDia) return false;
  if (ff && ff < primerDia) return false;
  return true;
}

function regimenDocEsPlanificado(regimenDoc) {
  return regimenDoc && regimenDoc.tipo_patron === "planificado";
}

/** Al menos un tramo HLg del grupo en el mes con régimen planificado. */
async function hayAgentesPlanificadosEnGrupoMes(grupoId, periodo) {
  const { personasGrupo, regimenes } = await cargarPersonasYRegimenesPlanGrupo(grupoId, periodo);
  return personasGrupo.some((pg) => regimenDocEsPlanificado(regimenes[pg.regimen_horario_id]));
}

async function assertPlanMensualConAgentesPlanificados(grupoId, periodo) {
  const ok = await hayAgentesPlanificadosEnGrupoMes(grupoId, periodo);
  if (!ok) {
    err(
      "failed-precondition",
      "[PLT-017] Este grupo no tiene agentes con régimen planificado en el período. No se puede crear un plan mensual; use la vista de equipo (turnos derivados del régimen).",
    );
  }
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

/** Una fila por tramo HLg en el mes (sin deduplicar persona_id). */
async function cargarPersonasYRegimenesPlanGrupo(grupoId, periodo) {
  const { periodo: periodoNorm, primerDia, ultimoDia } = rangoPeriodoMensual(periodo);
  const [anio, mes] = periodoNorm.split("-").map(Number);

  const hlgSnap = await db.collection("historial_laboral_grupos")
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("activo", "==", true)
    .get();

  if (hlgSnap.empty) {
    return { periodo: periodoNorm, personasGrupo: [], regimenes: {} };
  }

  const hlgFilas = [];
  for (const doc of hlgSnap.docs) {
    const d = doc.data();
    if (!hlgSolapaPeriodo(d, primerDia, ultimoDia)) continue;
    if (!d.regimen_horario_id) continue;
    hlgFilas.push({
      hlg_id: doc.id,
      persona_id: d.persona_id,
      grupo_de_trabajo_id: grupoId,
      regimen_horario_id: d.regimen_horario_id || null,
      fecha_inicio: d.fecha_inicio || null,
      fecha_fin: d.fecha_fin || null,
      regimen_fecha_ancla: d.regimen_fecha_ancla || null,
      dato_laboral_id: d.dato_laboral_id || null,
      activo: d.activo,
    });
  }

  const tramos = hlgSegmentosMes(hlgFilas, anio, mes);
  const metaPorHlg = new Map(hlgFilas.map((h) => [h.hlg_id, h]));

  const personasGrupo = tramos.map((t) => {
    const src = metaPorHlg.get(t.hlg_id) || {};
    return {
      fila_id: t.fila_id,
      hlg_id: t.hlg_id,
      persona_id: t.persona_id,
      regimen_horario_id: t.regimen_horario_id,
      vigente_desde: t.vigente_desde,
      vigente_hasta: t.vigente_hasta,
      fecha_inicio: src.fecha_inicio || t.fecha_inicio,
      fecha_fin: src.fecha_fin ?? t.fecha_fin ?? null,
      regimen_fecha_ancla: src.regimen_fecha_ancla || null,
      dato_laboral_id: src.dato_laboral_id || null,
    };
  });

  const regimenIds = new Set();
  const personaIds = new Set();

  for (const pg of personasGrupo) {
    if (pg.regimen_horario_id) regimenIds.add(pg.regimen_horario_id);
    if (pg.persona_id) personaIds.add(pg.persona_id);
  }

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

  const regimenes = {};
  for (const rid of regimenIds) {
    const rsnap = await db.collection("cfg_regimen_horario").doc(rid).get();
    if (rsnap.exists) {
      regimenes[rid] = { id: rid, ...rsnap.data() };
    }
  }

  for (const pg of personasGrupo) {
    const pdata = personaDocs[pg.persona_id] || {};
    const baseLabel = pdata.nombre_completo || pg.persona_id;
    const carga = derivarCargaSemanalDesdeRegimen(regimenes[pg.regimen_horario_id]);
    pg.persona_label =
      carga != null && Number.isFinite(Number(carga))
        ? `${baseLabel} · ${Number.isInteger(Number(carga)) ? Number(carga) : Math.round(Number(carga) * 10) / 10} hs`
        : baseLabel;
    pg.persona_dni = pdata.dni || null;
  }

  personasGrupo.sort((a, b) =>
    String(a.persona_label || a.persona_id).localeCompare(String(b.persona_label || b.persona_id), "es"),
  );

  return { periodo: periodoNorm, personasGrupo, regimenes, ultimoDia };
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
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertPlanAuth(request, grupoId, "leer");

  const { periodo: periodoNorm, personasGrupo, regimenes } = await cargarPersonasYRegimenesPlanGrupo(
    grupoId,
    periodo,
  );

  if (!personasGrupo.length) {
    return {
      personas_grupo: [],
      regimenes: {},
      periodo: periodoNorm,
      hay_agentes_planificados: false,
      requiere_plan_individual: false,
      agentes_nuevos: [],
      plan_mensual_id: null,
      plan_mensual_estado: null,
    };
  }

  // Cargar eventos/licencias proyectados del mes desde vis_* (sin nueva llamada frontend).
  const licenciasPorPersonaYmd = {};
  for (const pg of personasGrupo) {
    const pid = String(pg.persona_id || "").trim();
    if (!pid) continue;
    const visId = buildVisDocumentId(pid, `${periodoNorm}-01`, grupoId);
    const visSnap = await db.collection(COL_VISTAS_GRILLA_MES).doc(visId).get();
    if (!visSnap.exists) continue;
    const vis = visSnap.data() || {};
    const dias = vis.dias || {};
    const row = {};
    for (const [diaKey, payload] of Object.entries(dias)) {
      const eventos = Array.isArray(payload?.eventos) ? payload.eventos : [];
      if (eventos.length === 0) continue;
      const ymd = `${periodoNorm}-${String(diaKey).padStart(2, "0")}`;
      row[ymd] = eventos.map((ev) => ({
        solicitud_id: ev?.solicitud_id || null,
        articulo_id: ev?.articulo_id || null,
        codigo_grilla: ev?.codigo_grilla || null,
        estado_solicitud_id: ev?.estado_solicitud_id || null,
        color_ui: ev?.color_ui || null,
        nivel_ocupacion_dia_id: ev?.nivel_ocupacion_dia_id || null,
      }));
    }
    if (Object.keys(row).length > 0) licenciasPorPersonaYmd[pid] = row;
  }

  // Calendario institucional del mes (feriados/asuetos) para impacto directo en grilla.
  const calendarioInstitucionalMes = {};
  const [anio, mes] = periodoNorm.split("-").map(Number);
  const diasMes = new Date(anio, mes, 0).getDate();
  for (let d = 1; d <= diasMes; d += 1) {
    const ymd = `${periodoNorm}-${String(d).padStart(2, "0")}`;
    const info = await getInfoDia(ymd);
    if (info?.evento) {
      calendarioInstitucionalMes[ymd] = {
        es_feriado: true,
        tipo: String(info?.evento?.tipo || "feriado"),
        motivo: String(info?.evento?.descripcion || "").trim() || null,
        multiplicador: info.multiplicador || 1,
      };
    }
  }

  const hayAgentesPlanificados = Object.values(regimenes).some((reg) => regimenDocEsPlanificado(reg));

  let planMensualCanonico = null;
  const planesSnap = await db
    .collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodoNorm)
    .where("tipo_plan", "==", "mensual")
    .limit(20)
    .get();
  const planesActivos = planesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.eliminado !== true);
  if (planesActivos.length > 0) {
    planMensualCanonico = elegirPlanMensualCanonico(planesActivos);
  }

  const idsEnPlanOperativo = new Set();
  const hlgIdsEnPlanOperativo = new Set();
  if (planMensualCanonico && planMensualCanonico.estado !== "CERRADO") {
    for (const pid of personaIdsEnPlan(planMensualCanonico)) idsEnPlanOperativo.add(pid);
    for (const hid of hlgIdsEnPlan(planMensualCanonico)) hlgIdsEnPlanOperativo.add(hid);
  }
  const planIncActivo = planesActivos.find((p) => esPlanIncorporacionActivo(p));
  if (planIncActivo) {
    for (const pid of personaIdsEnPlan(planIncActivo)) idsEnPlanOperativo.add(pid);
    for (const hid of hlgIdsEnPlan(planIncActivo)) hlgIdsEnPlanOperativo.add(hid);
  }

  const tramosPorPersona = hlgTramosPorPersona(personasGrupo);
  const agentes_multiples_tramos = [...tramosPorPersona.entries()]
    .filter(([, tramos]) => tramos.length >= 2)
    .map(([persona_id, tramos]) => ({
      persona_id,
      persona_label: personasGrupo.find((p) => p.persona_id === persona_id)?.persona_label || persona_id,
      tramos,
    }));

  const agentesNuevos =
    planMensualCanonico && planMensualCanonico.estado !== "CERRADO"
      ? detectarAgentesNuevosPlanificados({
          personasGrupo,
          regimenes,
          personaIdsEnPlanMensual: idsEnPlanOperativo,
          hlgIdsEnPlanMensual: hlgIdsEnPlanOperativo,
        })
      : [];

  return {
    personas_grupo: personasGrupo,
    hlg_tramos_por_persona: Object.fromEntries(tramosPorPersona),
    agentes_multiples_tramos,
    total_filas: personasGrupo.length,
    total_personas: new Set(personasGrupo.map((p) => p.persona_id)).size,
    regimenes,
    periodo: periodoNorm,
    hay_agentes_planificados: hayAgentesPlanificados,
    requiere_plan_individual: agentesNuevos.length > 0,
    agentes_nuevos: agentesNuevos,
    plan_mensual_id: planMensualCanonico?.id || null,
    plan_mensual_estado: planMensualCanonico?.estado || null,
    plan_incorporacion_id: planIncActivo?.id || null,
    plan_incorporacion_estado: planIncActivo?.estado || null,
    licencias_por_persona_ymd: licenciasPorPersonaYmd,
    calendario_institucional_mes: calendarioInstitucionalMes,
  };
});

/**
 * Lookup personas para agentes_meta legible (nombres en VER plan).
 * @param {object[]} agentesPlan
 * @param {object|null} grillaAprobada
 */
async function resolverAgentesMetaVistaPlan(agentesPlan = [], grillaAprobada = null) {
  const ids = new Set();
  for (const ag of agentesPlan) {
    const pid = String(ag?.persona_id || "").trim();
    if (/^per_/i.test(pid)) ids.add(pid);
  }
  for (const ag of grillaAprobada?.agentes || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (/^per_/i.test(pid)) ids.add(pid);
  }

  const personaPorId = new Map();
  const idList = [...ids];
  for (let i = 0; i < idList.length; i += PERSONAS_GETALL_CHUNK) {
    const chunk = idList.slice(i, i + PERSONAS_GETALL_CHUNK);
    const refs = chunk.map((id) => db.collection(COL_PERSONAS).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const d = snap.data() || {};
      const dni = String(d.dni || d?.documento?.numero || "").trim() || null;
      personaPorId.set(snap.id, {
        nombre: nombreLegiblePersonaDoc(d),
        dni,
        persona_label: buildPersonaLabel(d),
      });
    }
  }

  const metaMap = new Map();
  const pushMeta = (ag) => {
    const pid = String(ag?.persona_id || "").trim();
    if (!pid) return;
    const fromDb = personaPorId.get(pid);
    const nombrePlan = ag.nombre || ag.nombre_completo || ag.persona_label || null;
    const dniPlan = ag.dni || ag.persona_dni || null;
    metaMap.set(pid, {
      persona_id: pid,
      nombre: fromDb?.nombre || nombrePlan || null,
      dni: fromDb?.dni || dniPlan || null,
      persona_label: fromDb?.persona_label || nombrePlan || fromDb?.nombre || null,
    });
  };

  for (const ag of agentesPlan) pushMeta(ag);
  for (const ag of grillaAprobada?.agentes || []) {
    if (!metaMap.has(String(ag?.persona_id || "").trim())) pushMeta(ag);
  }

  return [...metaMap.values()];
}

/**
 * Enriquece agentes de grilla_aprobada con tramo HLg del mes (vigencia, carga).
 * Planes legacy sin metadata en snapshot: lookup por grupo/período al servir la vista.
 * @param {object|null} grillaAprobada
 * @param {{ grupo_id?: string, periodo?: string }} planData
 */
async function enriquecerGrillaAprobadaConTramos(grillaAprobada, planData) {
  if (!grillaAprobada?.agentes?.length) return grillaAprobada;
  const grupoId = String(planData?.grupo_id || "").trim();
  const periodo = String(planData?.periodo || grillaAprobada?.periodo || "").trim();
  if (!grupoId || !/^\d{4}-\d{2}$/.test(periodo)) return grillaAprobada;

  const ctx = await cargarPersonasYRegimenesPlanGrupo(grupoId, periodo);
  const byFila = new Map();
  const byHlg = new Map();
  for (const pg of ctx.personasGrupo || []) {
    const fid = pg.fila_id || buildFilaId(pg.persona_id, pg.hlg_id);
    byFila.set(fid, pg);
    if (pg.hlg_id) byHlg.set(String(pg.hlg_id), pg);
  }

  const agentes = grillaAprobada.agentes.map((ag) => {
    const hid = String(ag?.hlg_id || "").trim();
    const fid = buildFilaId(ag.persona_id, hid);
    const pg = byFila.get(fid) || (hid ? byHlg.get(hid) : null);
    if (!pg) return ag;

    const carga =
      ag.carga_horaria_semanal != null
        ? ag.carga_horaria_semanal
        : derivarCargaSemanalDesdeRegimen(ctx.regimenes[pg.regimen_horario_id]);

    return {
      ...ag,
      fila_id: ag.fila_id || fid,
      vigente_desde: ag.vigente_desde || pg.vigente_desde || null,
      vigente_hasta: ag.vigente_hasta || pg.vigente_hasta || null,
      carga_horaria_semanal: carga ?? null,
      regimen_horario_id: ag.regimen_horario_id || pg.regimen_horario_id || null,
    };
  });

  return { ...grillaAprobada, agentes };
}

/**
 * Vista unificada de plan mensual: lectura de grilla_aprobada (SoT histórico).
 * Lazy backfill si HABILITADO sin snapshot (planes legacy).
 */
const obtenerVistaPlanTurnoServicio = onCall({ invoker: "public" }, async (request) => {
  const planId = request.data && typeof request.data.plan_id === "string" ? request.data.plan_id.trim() : "";
  if (!planId) err("invalid-argument", "[PLT-VST-001] plan_id requerido.");

  const ref = db.collection(COL_PLANES).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[PLT-VST-002] Plan no encontrado.");
  const data = snap.data() || {};
  if (data.eliminado === true) err("not-found", "[PLT-VST-003] Plan eliminado.");

  let grillaAprobada = data.grilla_aprobada || null;
  let esSnapshotPersistido = Boolean(grillaAprobada);

  if (data.tipo_plan === "mensual" && !grillaAprobada) {
    grillaAprobada = await construirGrillaAprobada({ plan: data, planId });
    if (grillaAprobada && data.estado === "HABILITADO") {
      await ref.update({
        grilla_aprobada: grillaAprobada,
        grilla_aprobada_en: FieldValue.serverTimestamp(),
      });
      esSnapshotPersistido = true;
    }
  }

  const agentesMeta = await resolverAgentesMetaVistaPlan(data.agentes || [], grillaAprobada);

  if (data.tipo_plan === "mensual" && grillaAprobada) {
    grillaAprobada = await enriquecerGrillaAprobadaConTramos(grillaAprobada, data);
  }

  return {
    plan: {
      id: snap.id,
      tipo_plan: data.tipo_plan,
      estado: data.estado,
      grupo_id: data.grupo_id,
      grupo_label: data.grupo_label || null,
      periodo: data.periodo || null,
      materializacion_fallida: data.materializacion_fallida === true,
      historial_aprobaciones: data.historial_aprobaciones || [],
      observaciones_rechazo: data.observaciones_rechazo || null,
      grilla_aprobada_en: data.grilla_aprobada_en || null,
      es_snapshot_persistido: esSnapshotPersistido,
    },
    grilla_aprobada: grillaAprobada,
    agentes_meta: agentesMeta,
  };
});

module.exports = {
  iniciarIncorporacionPlanMensual,
  guardarPlanTurnoServicio,
  enviarPlanTurnoServicio,
  aprobarPlanTurnoServicio,
  rechazarPlanTurnoServicio,
  revertirPlanTurnoServicio,
  eliminarPlanTurnoServicio,
  cerrarPlanPerpetuo,
  listarPlanesTurnoServicio,
  listarPlanesPendientesRrhh,
  listarContextoPlanGrupo,
  obtenerVistaPlanTurnoServicio,
};

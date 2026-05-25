"use strict";

const { FieldValue } = require("./context");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_APROBADA,
} = require("./solicitudesArticuloEstados");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const { registrarEventoTicket } = require("./registrarEventoTicket");
/** Oleada A — visibilidad RRHH (RFC §2 ítem 17). */
const ESTADOS_BANDEJA_RRHH_VISIBLES = [
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
];

/**
 * @param {Record<string, unknown>} sol
 */
function bandejaRrhhModoItem(sol) {
  const est = String(sol.estado_solicitud_id || "").trim();
  if (est === ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return {
      modo: "legacy_rrhh",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Pendiente RRHH (legacy)",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE && sol.autorizacion_rrhh_sustituta === true) {
    return {
      modo: "cierre_sustituta",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Huérfana — cierre RRHH",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return {
      modo: "visibilidad_jefe",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "En revisión por jefatura",
    };
  }
  if (est === ESTADO_SOLICITUD_APROBADA) {
    if (sol.rrhh_toma_conocimiento_en) {
      return {
        modo: "toma_conocimiento_ok",
        puede_aprobar_rechazar: false,
        puede_registrar_toma_conocimiento: false,
        etiqueta_estado: "Toma de conocimiento registrada",
      };
    }
    return {
      modo: "toma_conocimiento",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: true,
      etiqueta_estado: "Aprobada — pendiente toma de conocimiento RRHH",
    };
  }
  return {
    modo: "otro",
    puede_aprobar_rechazar: false,
    puede_registrar_toma_conocimiento: false,
    etiqueta_estado: est,
  };
}
const { loadArticuloDisplay, resolverDecisionJefeSolicitud, esHuerfanaEnRevisionJefe } =
  require("./solicitudBandejaJefeCore");
const { revisorPuedeAutorizarJerarquico } = require("./solicitudAutorizacionJerarquicaCore");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");

const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const SCAN_LIMIT = 400;

const ESTADOS_QUERY_TODOS = [
  ...ESTADOS_BANDEJA_RRHH_VISIBLES,
  ESTADO_SOLICITUD_RECHAZADA,
];

const FILTRO_VISTA_PENDIENTES = "pendientes";
const FILTRO_VISTA_TODOS = "todos";

/**
 * @param {unknown} raw
 */
function parseBandejaRrhhListOpts(raw) {
  return parseBandejaListPageOpts(raw, { filtroDefault: FILTRO_VISTA_PENDIENTES });
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} filtroVista
 */
function itemPasaFiltroVista(item, filtroVista) {
  const v = String(filtroVista || FILTRO_VISTA_PENDIENTES);
  if (v === FILTRO_VISTA_TODOS) return true;
  if (v === FILTRO_VISTA_PENDIENTES) {
    return item.puede_aprobar_rechazar === true || item.puede_registrar_toma_conocimiento === true;
  }
  if (v === "aprobados") {
    return String(item.estado_solicitud_id) === ESTADO_SOLICITUD_APROBADA;
  }
  if (v === "rechazados") {
    return String(item.estado_solicitud_id) === ESTADO_SOLICITUD_RECHAZADA;
  }
  if (v === "en_revision_jefe") {
    return String(item.estado_solicitud_id) === ESTADO_SOLICITUD_EN_REVISION_JEFE;
  }
  if (v === "en_revision_rrhh") {
    return String(item.estado_solicitud_id) === ESTADO_SOLICITUD_EN_REVISION_RRHH;
  }
  if (v === "toma_conocimiento_pendiente") {
    return item.bandeja_rrhh_modo === "toma_conocimiento";
  }
  return true;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("./solicitudBandejaRrhhCore").parseBandejaRrhhListOpts} optsParsed — ver parseBandejaRrhhListOpts
 */
async function listarSolicitudesBandejaRrhh(db, opts = {}) {
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaRrhhListOpts(opts);
  const estadosQuery =
    filtroVista === "rechazados"
      ? [ESTADO_SOLICITUD_RECHAZADA]
      : filtroVista === FILTRO_VISTA_TODOS || filtroVista === "aprobados"
        ? ESTADOS_QUERY_TODOS
        : ESTADOS_BANDEJA_RRHH_VISIBLES;

  let titularIdsDni = null;
  if (dni) {
    titularIdsDni = await resolverPersonaIdsPorDni(db, dni);
    if (titularIdsDni && titularIdsDni.size === 0) {
      return {
        solicitudes: [],
        page_info: {
          page_size: pageSize,
          has_more: false,
          next_cursor: null,
          total_filtrado: 0,
        },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "in", estadosQuery)
    .limit(SCAN_LIMIT)
    .get();

  const out = [];
  const personaCache = new Map();
  const articuloCache = new Map();

  for (const doc of snap.docs) {
    const sol = { id: doc.id, ...(doc.data() || {}) };
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;
    if (titularIdsDni && !titularIdsDni.has(titularId)) continue;

    let personaRow = personaCache.get(titularId);
    if (personaRow === undefined) {
      const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
      const p = pSnap.exists ? pSnap.data() || {} : {};
      const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
      personaRow = {
        label: nom || titularId,
        dni: String(p.dni || "").replace(/\D/g, "").trim(),
      };
      personaCache.set(titularId, personaRow);
    }

    if (usuario) {
      const hayUsuario =
        String(personaRow.label || "")
          .toLowerCase()
          .includes(usuario) ||
        String(personaRow.dni || "").includes(usuario.replace(/\D/g, ""));
      if (!hayUsuario) continue;
    }

    const artId = String(sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);
    const modo = bandejaRrhhModoItem(sol);

    const item = {
      solicitud_id: sol.id,
      articulo_id: artId,
      articulo_label: artDisplay.articulo_label,
      codigo_grilla: artDisplay.codigo_grilla,
      articulo_nombre: artDisplay.nombre,
      titular_persona_id: titularId,
      titular_label: personaRow.label,
      titular_dni: personaRow.dni || null,
      fecha_desde: fechaRef,
      fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
      dias_solicitados: Number(sol.dias_solicitados) || 1,
      patron_saldo: String(sol.patron_saldo || ""),
      estado_solicitud_id: sol.estado_solicitud_id,
      creado_en: sol.creado_en || null,
      grupo_trabajo_id_ancla: String(sol.grupo_trabajo_id_ancla || "").trim() || null,
      jefe_revision_en: sol.jefe_revision_en || null,
      jefe_revision_persona_id: String(sol.jefe_revision_persona_id || "").trim() || null,
      jefe_motivo: sol.jefe_motivo != null ? String(sol.jefe_motivo) : null,
      rrhh_revision_en: sol.rrhh_revision_en || null,
      rrhh_revision_persona_id: String(sol.rrhh_revision_persona_id || "").trim() || null,
      rrhh_motivo: sol.rrhh_motivo != null ? String(sol.rrhh_motivo) : null,
      rrhh_toma_conocimiento_motivo:
        sol.rrhh_toma_conocimiento_motivo != null ? String(sol.rrhh_toma_conocimiento_motivo) : null,
      autorizadores_elegibles_ids: Array.isArray(sol.autorizadores_elegibles_ids)
        ? sol.autorizadores_elegibles_ids
        : [],
      autorizacion_rrhh_sustituta: sol.autorizacion_rrhh_sustituta === true,
      bandeja_rrhh_modo: modo.modo,
      puede_aprobar_rechazar: modo.puede_aprobar_rechazar,
      puede_registrar_toma_conocimiento: modo.puede_registrar_toma_conocimiento === true,
      etiqueta_estado: modo.etiqueta_estado,
      rrhh_toma_conocimiento_en: sol.rrhh_toma_conocimiento_en || null,
      motor_snapshot:
        sol.motor_snapshot && typeof sol.motor_snapshot === "object" ? sol.motor_snapshot : null,
      motor_validado_en: sol.motor_validado_en || null,
    };

    if (!itemPasaFiltroVista(item, filtroVista)) continue;
    out.push(item);
  }

  out.sort((a, b) => String(a.fecha_desde).localeCompare(String(b.fecha_desde)));
  const page = paginarBandejaOrdenada(out, { cursor, pageSize });

  return {
    solicitudes: page.solicitudes,
    page_info: {
      page_size: pageSize,
      has_more: page.has_more,
      next_cursor: page.next_cursor,
      total_filtrado: page.total_filtrado,
      scan_limit: SCAN_LIMIT,
    },
    filtros: {
      filtro_vista: filtroVista,
      dni: dni || null,
      usuario: usuario || null,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 */
/**
 * @param {Record<string, unknown>} sol
 * @returns {"cierre_sustituta"|"legacy_rrhh"|"invalido"}
 */
function tipoFlujoResolverDecisionRrhh(sol) {
  if (esHuerfanaEnRevisionJefe(sol)) return "cierre_sustituta";
  if (String(sol.estado_solicitud_id || "").trim() === ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return "legacy_rrhh";
  }
  return "invalido";
}

async function resolverDecisionRrhhSolicitud(db, solId, revisorPersonaId, decision, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  const flujo = tipoFlujoResolverDecisionRrhh(sol);

  if (flujo === "cierre_sustituta") {
    if (!revisorPuedeAutorizarJerarquico(sol, revisorPersonaId, { rrhhSustituto: true })) {
      return {
        ok: false,
        codigo: "PERMISSION_DENIED",
        mensaje: "No tenés permiso de cierre sustituto RRHH para esta solicitud.",
      };
    }
    return resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, false, {
      rrhhSustituto: true,
    });
  }

  if (flujo !== "legacy_rrhh") {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje:
        "La solicitud no está en revisión RRHH (legacy) ni es huérfana pendiente de cierre sustituto.",
    };
  }

  const titularId = String(sol.titular_persona_id || "").trim();

  if (decision === "aprobar") {
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      rrhh_revision_persona_id: revisorPersonaId,
      rrhh_revision_en: FieldValue.serverTimestamp(),
      rrhh_motivo: motivo || null,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      {
        ...sol,
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        codigo_grilla: artDisplay.codigo_grilla,
      },
      MDC_COMANDO_CONSOLIDAR_APROBADO,
    );
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    };
  }

  if (decision === "rechazar") {
    let reverso = false;
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_RRHH) return;

      reverso = await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        rrhh_revision_persona_id: revisorPersonaId,
        rrhh_revision_en: FieldValue.serverTimestamp(),
        rrhh_motivo: motivo || null,
        motor_reverso_rrhh_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      { ...sol, codigo_grilla: artDisplay.codigo_grilla },
      MDC_COMANDO_REVERTIR_PROYECCION,
    );

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
      motor_reverso_rrhh_aplicado: reverso,
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

/**
 * Toma de conocimiento RRHH (Oleada A4): no cambia estado sustantivo.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {string} motivo
 */
async function registrarTomaConocimientoRrhhSolicitud(db, solId, revisorPersonaId, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_APROBADA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo se registra toma de conocimiento en solicitudes ya aprobadas por jefatura.",
    };
  }
  if (sol.rrhh_toma_conocimiento_en) {
    return {
      ok: false,
      codigo: "TC_YA_REGISTRADA",
      mensaje: "La toma de conocimiento ya fue registrada.",
    };
  }

  await solRef.update({
    rrhh_toma_conocimiento_persona_id: revisorPersonaId,
    rrhh_toma_conocimiento_en: FieldValue.serverTimestamp(),
    rrhh_toma_conocimiento_motivo: motivo || null,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const titularId = String(sol.titular_persona_id || "").trim();
  void registrarEventoTicket(db, solId, {
    tipo_evento: TIPO_EVENTO_TICKET.TOMA_CONOCIMIENTO_RRHH,
    actor_persona_id: revisorPersonaId,
    titular_persona_id: titularId,
    estado_anterior_id: ESTADO_SOLICITUD_APROBADA,
    estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
    origen: ORIGEN_EVENTO.CALLABLE,
    accion: "rrhh_toma_conocimiento",
    metadata: {
      rrhh_toma_conocimiento_motivo: motivo || null,
      articulo_id: String(sol.articulo_id || "") || null,
      fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
      codigo_grilla: sol.codigo_grilla || null,
    },
  });

  return {
    ok: true,
    solicitud_id: solId,
    estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
  };
}

module.exports = {
  listarSolicitudesBandejaRrhh,
  resolverDecisionRrhhSolicitud,
  registrarTomaConocimientoRrhhSolicitud,
  tipoFlujoResolverDecisionRrhh,
  bandejaRrhhModoItem,
  parseBandejaRrhhListOpts,
  itemPasaFiltroVista,
  paginarBandejaOrdenada: paginarBandejaOrdenada,
  FILTRO_VISTA_PENDIENTES,
  FILTRO_VISTA_TODOS,
};

"use strict";

const { FieldValue } = require("./context");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_APROBADA,
} = require("./solicitudesArticuloEstados");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const { registrarEventoTicket } = require("./registrarEventoTicket");
const {
  CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS,
  mensajeParaCodigoAutorizacion,
} = require("./solicitudAutorizacionCodigos");
const {
  resolverCadenaAutorizacion,
  buildAutorizacionSnapshotFields,
  revisorPuedeAutorizarJerarquico,
  revalidarRevisorEnAutorizadores,
} = require("./solicitudAutorizacionJerarquicaCore");

/**
 * @param {Record<string, unknown>} sol
 * @returns {boolean}
 */
function esHuerfanaEnRevisionJefe(sol) {
  return (
    String(sol.estado_solicitud_id || "").trim() === ESTADO_SOLICITUD_EN_REVISION_JEFE &&
    sol.autorizacion_rrhh_sustituta === true
  );
}

const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const COL_CFG_ART = "cfg_articulos";
const SCAN_LIMIT = 400;
const FILTRO_JEFE_PENDIENTES = "pendientes";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {Map<string, { codigo_grilla: string, nombre: string, articulo_label: string }>} cache
 */
async function loadArticuloDisplay(db, articuloId, cache) {
  const id = String(articuloId || "").trim();
  if (!id) {
    return { codigo_grilla: "", nombre: "", articulo_label: "Solicitud" };
  }
  if (cache.has(id)) return cache.get(id);

  const snap = await db.collection(COL_CFG_ART).doc(id).get();
  const core = snap.exists ? snap.data() || {} : {};
  const codigo_grilla = String(core.codigo || core.nombre_corto || "").trim();
  const nombre = String(core.nombre || core.codigo || "").trim();
  let articulo_label = "Artículo";
  if (codigo_grilla && nombre) articulo_label = `${codigo_grilla} — ${nombre}`;
  else articulo_label = codigo_grilla || nombre || id;

  const row = { codigo_grilla, nombre, articulo_label };
  cache.set(id, row);
  return row;
}

/**
 * Oleada A: visibilidad bandeja jefe (sin bypass RRHH; huérfanas solo RRHH).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {string} revisorPersonaId
 */
async function revisorVeSolicitudEnBandejaJefe(db, sol, revisorPersonaId) {
  if (sol.autorizacion_rrhh_sustituta === true) return false;

  const titularId = String(sol.titular_persona_id || "").trim();
  const ancla = String(sol.grupo_trabajo_id_ancla || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  if (!/^per_/i.test(titularId) || !/^gdt_/i.test(ancla)) return false;

  const cadena = await resolverCadenaAutorizacion(db, {
    titularPersonaId: titularId,
    grupoTrabajoIdAncla: ancla,
    fechaRefYmd: fechaRef,
  });
  if (!cadena.ok || cadena.autorizacion_rrhh_sustituta) return false;
  return revisorPuedeAutorizarJerarquico(buildAutorizacionSnapshotFields(cadena), revisorPersonaId);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} titularId
 * @param {Map<string, { label: string, dni: string }>} personaCache
 */
async function loadPersonaBandeja(db, titularId, personaCache) {
  let row = personaCache.get(titularId);
  if (row !== undefined) return row;
  const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
  const p = pSnap.exists ? pSnap.data() || {} : {};
  const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
  row = {
    label: nom || titularId,
    dni: String(p.dni || "").replace(/\D/g, "").trim(),
  };
  personaCache.set(titularId, row);
  return row;
}

/**
 * @param {string} usuario
 * @param {{ label: string, dni: string }} personaRow
 */
function personaCoincideUsuario(usuario, personaRow) {
  if (!usuario) return true;
  return (
    String(personaRow.label || "")
      .toLowerCase()
      .includes(usuario) ||
    String(personaRow.dni || "").includes(usuario.replace(/\D/g, ""))
  );
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {Map} personaCache
 * @param {Map} articuloCache
 * @param {{ puede_decidir: boolean, etiqueta_estado: string }} meta
 */
async function itemListaBandejaJefe(db, sol, personaCache, articuloCache, meta) {
  const titularId = String(sol.titular_persona_id || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
  const artId = String(sol.articulo_id || "").trim();
  const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);
  return {
    solicitud_id: String(sol.id || ""),
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
    puede_decidir: meta.puede_decidir === true,
    etiqueta_estado: meta.etiqueta_estado,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ revisorPersonaId: string, rrhhBypass?: boolean } & Record<string, unknown>} opts
 */
async function listarSolicitudesBandejaJefe(db, opts) {
  const revisorPersonaId = String(opts.revisorPersonaId || "").trim();
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaListPageOpts(opts, {
    filtroDefault: FILTRO_JEFE_PENDIENTES,
  });

  let titularIdsDni = null;
  if (dni) {
    titularIdsDni = await resolverPersonaIdsPorDni(db, dni);
    if (titularIdsDni && titularIdsDni.size === 0) {
      return {
        solicitudes: [],
        page_info: { page_size: pageSize, has_more: false, next_cursor: null, total_filtrado: 0 },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const personaCache = new Map();
  const articuloCache = new Map();
  const byId = new Map();

  const incluirPendientes =
    filtroVista === FILTRO_JEFE_PENDIENTES || filtroVista === "todos";
  const incluirAprobados = filtroVista === "aprobados_por_mi" || filtroVista === "todos";
  const incluirRechazados = filtroVista === "rechazados_por_mi" || filtroVista === "todos";

  if (incluirPendientes) {
    const snap = await db
      .collection(COL_SOL)
      .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_EN_REVISION_JEFE)
      .limit(SCAN_LIMIT)
      .get();
    for (const doc of snap.docs) {
      const sol = { id: doc.id, ...(doc.data() || {}) };
      const titularId = String(sol.titular_persona_id || "").trim();
      const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
      if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;
      if (titularIdsDni && !titularIdsDni.has(titularId)) continue;
      if (!(await revisorVeSolicitudEnBandejaJefe(db, sol, revisorPersonaId))) continue;
      const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
      if (!personaCoincideUsuario(usuario, personaRow)) continue;
      const item = await itemListaBandejaJefe(db, sol, personaCache, articuloCache, {
        puede_decidir: true,
        etiqueta_estado: "Pendiente tu decisión",
      });
      byId.set(item.solicitud_id, item);
    }
  }

  async function agregarHistorialJefe(estadoId, etiqueta) {
    const snap = await db
      .collection(COL_SOL)
      .where("jefe_revision_persona_id", "==", revisorPersonaId)
      .where("estado_solicitud_id", "==", estadoId)
      .limit(SCAN_LIMIT)
      .get();
    for (const doc of snap.docs) {
      const sol = { id: doc.id, ...(doc.data() || {}) };
      const titularId = String(sol.titular_persona_id || "").trim();
      const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
      if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;
      if (titularIdsDni && !titularIdsDni.has(titularId)) continue;
      const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
      if (!personaCoincideUsuario(usuario, personaRow)) continue;
      const item = await itemListaBandejaJefe(db, sol, personaCache, articuloCache, {
        puede_decidir: false,
        etiqueta_estado: etiqueta,
      });
      byId.set(item.solicitud_id, item);
    }
  }

  if (incluirAprobados) {
    await agregarHistorialJefe(ESTADO_SOLICITUD_APROBADA, "Aprobada por vos (cierre jerárquico)");
  }
  if (incluirRechazados) {
    await agregarHistorialJefe(ESTADO_SOLICITUD_RECHAZADA, "Rechazada por vos");
  }

  const out = Array.from(byId.values());
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
 * @param {boolean} [_rrhhBypass] — deprecado Oleada A (ignorado)
 * @param {{ rrhhSustituto?: boolean }} [opts] — cierre sustituto huérfana desde bandeja RRHH (A4)
 */
async function resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, _rrhhBypass, opts = {}) {
  const rrhhSustituto = opts.rrhhSustituto === true;
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está en revisión por jefe." };
  }

  const titularId = String(sol.titular_persona_id || "").trim();

  if (sol.autorizacion_rrhh_sustituta === true && !rrhhSustituto) {
    return {
      ok: false,
      codigo: "PERMISSION_DENIED",
      mensaje: "Esta solicitud debe gestionarse desde la bandeja RRHH (autorización sustituta).",
    };
  }

  if (rrhhSustituto) {
    if (!esHuerfanaEnRevisionJefe(sol)) {
      return {
        ok: false,
        codigo: "ESTADO_INVALIDO",
        mensaje: "Solo solicitudes huérfanas en revisión admiten cierre sustituto RRHH.",
      };
    }
    if (!revisorPuedeAutorizarJerarquico(sol, revisorPersonaId, { rrhhSustituto: true })) {
      return {
        ok: false,
        codigo: "PERMISSION_DENIED",
        mensaje: "No tenés permiso de cierre sustituto RRHH para esta solicitud.",
      };
    }
  } else {
  const permiso = await revalidarRevisorEnAutorizadores(db, sol, revisorPersonaId);
  if (!permiso.ok) {
    const codigo = permiso.codigo || "PERMISSION_DENIED";
    return {
      ok: false,
      codigo,
      mensaje:
        codigo === CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS
          ? mensajeParaCodigoAutorizacion(CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS)
          : permiso.mensaje || "No podés gestionar esta solicitud.",
    };
  }
  }

  const accionAprobar = rrhhSustituto ? "rrhh_sustituta_aprobar" : "jefe_aprobar";
  const accionRechazar = rrhhSustituto ? "rrhh_sustituta_rechazar" : "jefe_rechazar";

  if (decision === "aprobar") {
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      const patch = {
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: motivo || null,
        actualizado_en: FieldValue.serverTimestamp(),
      };
      if (rrhhSustituto) {
        patch.cierre_rrhh_sustituta = true;
      }
      tx.update(solRef, patch);
    });

    const postSnap = await solRef.get();
    const postSol = postSnap.exists ? postSnap.data() || {} : sol;
    if (String(postSol.estado_solicitud_id) !== ESTADO_SOLICITUD_APROBADA) {
      return {
        ok: false,
        codigo: "ESTADO_INVALIDO",
        mensaje: "La solicitud ya no está en revisión por jefe.",
      };
    }

    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      {
        ...postSol,
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        codigo_grilla: artDisplay.codigo_grilla,
        grupo_autorizacion_id: postSol.grupo_autorizacion_id || null,
      },
      MDC_COMANDO_CONSOLIDAR_APROBADO,
    );
    void registrarEventoTicket(db, solId, {
      tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
      actor_persona_id: revisorPersonaId,
      titular_persona_id: titularId,
      estado_anterior_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
      origen: ORIGEN_EVENTO.CALLABLE,
      accion: accionAprobar,
      metadata: {
        decision: "aprobar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        grupo_autorizacion_id: postSol.grupo_autorizacion_id || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
        autorizacion_rrhh_sustituta: rrhhSustituto,
        cierre_rrhh_sustituta: rrhhSustituto,
      },
    });
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    };
  }

  if (decision === "rechazar") {
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: motivo || null,
        motor_reverso_jefe_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(db, solId, {
      ...sol,
      codigo_grilla: artDisplay.codigo_grilla,
    }, MDC_COMANDO_REVERTIR_PROYECCION);

    void registrarEventoTicket(db, solId, {
      tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
      actor_persona_id: revisorPersonaId,
      titular_persona_id: titularId,
      estado_anterior_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      estado_nuevo_id: ESTADO_SOLICITUD_RECHAZADA,
      origen: ORIGEN_EVENTO.CALLABLE,
      accion: accionRechazar,
      metadata: {
        decision: "rechazar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
        autorizacion_rrhh_sustituta: rrhhSustituto,
        cierre_rrhh_sustituta: rrhhSustituto,
      },
    });

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

module.exports = {
  listarSolicitudesBandejaJefe,
  resolverDecisionJefeSolicitud,
  revisorVeSolicitudEnBandejaJefe,
  loadArticuloDisplay,
  esHuerfanaEnRevisionJefe,
};

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

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const COL_CFG_ART = "cfg_articulos";
const LIST_LIMIT = 80;

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
 * @param {{ revisorPersonaId: string, rrhhBypass?: boolean }} opts — rrhhBypass ignorado (Oleada A)
 */
async function listarSolicitudesBandejaJefe(db, opts) {
  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_EN_REVISION_JEFE)
    .limit(LIST_LIMIT)
    .get();

  const candidatas = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const out = [];
  const personaCache = new Map();
  const articuloCache = new Map();

  for (const sol of candidatas) {
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;

    const ok = await revisorVeSolicitudEnBandejaJefe(db, sol, opts.revisorPersonaId);
    if (!ok) continue;

    let titularLabel = personaCache.get(titularId);
    if (titularLabel === undefined) {
      const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
      const p = pSnap.exists ? pSnap.data() || {} : {};
      const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
      titularLabel = nom || titularId;
      personaCache.set(titularId, titularLabel);
    }

    const artId = String(sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);

    out.push({
      solicitud_id: sol.id,
      articulo_id: artId,
      articulo_label: artDisplay.articulo_label,
      codigo_grilla: artDisplay.codigo_grilla,
      articulo_nombre: artDisplay.nombre,
      titular_persona_id: titularId,
      titular_label: titularLabel,
      fecha_desde: fechaRef,
      fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
      dias_solicitados: Number(sol.dias_solicitados) || 1,
      patron_saldo: String(sol.patron_saldo || ""),
      estado_solicitud_id: sol.estado_solicitud_id,
      creado_en: sol.creado_en || null,
    });
  }

  out.sort((a, b) => String(b.fecha_desde).localeCompare(String(a.fecha_desde)));
  return { solicitudes: out, limite: LIST_LIMIT };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 * @param {boolean} [_rrhhBypass] — deprecado Oleada A (ignorado)
 */
async function resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, _rrhhBypass) {
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

  if (sol.autorizacion_rrhh_sustituta === true) {
    return {
      ok: false,
      codigo: "PERMISSION_DENIED",
      mensaje: "Esta solicitud debe gestionarse desde la bandeja RRHH (autorización sustituta).",
    };
  }

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

  if (decision === "aprobar") {
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: motivo || null,
        actualizado_en: FieldValue.serverTimestamp(),
      });
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
      accion: "jefe_aprobar",
      metadata: {
        decision: "aprobar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        grupo_autorizacion_id: postSol.grupo_autorizacion_id || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
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
      accion: "jefe_rechazar",
      metadata: {
        decision: "rechazar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
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
};
